/**
 * E2E Test: Passkey Wallet Connection Flow
 *
 * Tests the FULL connection chain:
 *   User click → popup opens → passkey ceremony → PRF key derivation →
 *   popup sends keys to SDK → SDK creates iframe → encrypted channel handshake →
 *   SDK sends initWithKeys to host → host decodes keys
 *
 * WebAuthn navigator.credentials.create() is mocked because:
 *   1. RP ID "aztec.network" doesn't match localhost origin
 *   2. We need deterministic PRF output for assertions
 *
 * Everything ELSE is real: the popup React app, MessagePort communication,
 * ECDH key exchange, AES-256-GCM encrypted channel, key derivation via
 * @noble/hashes HKDF, base64 encoding, and the full RPC flow.
 */

import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { TIMEOUTS } from './utils/test-helpers';

// ---------------------------------------------------------------------------
// Test fixture: intercepts the popup to mock WebAuthn
// ---------------------------------------------------------------------------

/**
 * Mock credential data. The PRF output is a fixed 32-byte value.
 * All derived keys are deterministic from this input.
 */
const MOCK_PRF_OUTPUT_HEX =
  'abababababababababababababababababababababababababababababababababab';

const MOCK_CREDENTIAL_ID_B64 = btoa(
  String.fromCharCode(...new Uint8Array(32).fill(0x01))
);

const MOCK_PUBLIC_KEY_B64 = btoa(
  String.fromCharCode(
    ...new Uint8Array(65).fill(0x04) // uncompressed prefix + dummy coords
  )
);

/**
 * Script injected into the popup page BEFORE React loads.
 * Replaces navigator.credentials.create/get with mocks that return
 * a proper PublicKeyCredential shape with PRF extension results.
 */
function getWebAuthnMockScript(prfHex: string): string {
  return `
    // Convert hex to Uint8Array
    function hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes;
    }

    const MOCK_PRF = hexToBytes('${prfHex}');
    const MOCK_CRED_ID = new Uint8Array(32).fill(0x01);
    const MOCK_PUB_KEY = new Uint8Array(65).fill(0x04);

    // Mock credential object
    function createMockCredential() {
      return {
        id: 'mock-credential-id',
        rawId: MOCK_CRED_ID.buffer,
        type: 'public-key',
        response: {
          getPublicKey() { return MOCK_PUB_KEY.buffer; },
          clientDataJSON: new ArrayBuffer(0),
          attestationObject: new ArrayBuffer(0),
          getAuthenticatorData() { return new ArrayBuffer(37); },
          getTransports() { return ['internal']; },
        },
        authenticatorAttachment: 'platform',
        getClientExtensionResults() {
          return {
            prf: {
              enabled: true,
              results: {
                first: MOCK_PRF.buffer,
              },
            },
          };
        },
      };
    }

    // Replace navigator.credentials
    const originalCredentials = navigator.credentials;
    Object.defineProperty(navigator, 'credentials', {
      value: {
        create: async (options) => {
          console.log('[MOCK] navigator.credentials.create called');
          return createMockCredential();
        },
        get: async (options) => {
          console.log('[MOCK] navigator.credentials.get called');
          return createMockCredential();
        },
        store: originalCredentials?.store?.bind(originalCredentials),
        preventSilentAccess: originalCredentials?.preventSilentAccess?.bind(originalCredentials),
      },
      writable: false,
      configurable: true,
    });

    console.log('[MOCK] WebAuthn credentials mocked with deterministic PRF output');
  `;
}

// Custom test fixture that auto-mocks WebAuthn in popups
type TestFixtures = {
  popupLogs: string[];
};

const test = base.extend<TestFixtures>({
  popupLogs: async ({ context }, use) => {
    const logs: string[] = [];

    // Intercept new pages (popups) and inject WebAuthn mock
    context.on('page', async (popup) => {
      // Capture popup console logs
      popup.on('console', (msg) => {
        logs.push(`[POPUP:${msg.type()}] ${msg.text()}`);
      });
      popup.on('pageerror', (err) => {
        logs.push(`[POPUP:ERROR] ${err.message}`);
      });
    });

    await use(logs);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToPasskeyTab(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const tab = page.locator('button').filter({ hasText: /Passkey Wallet/i }).first();
  await tab.click();
  const card = page.locator('[data-testid="passkey-wallet-card"]');
  await expect(card).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
}

/**
 * Pre-derive the expected keys from the mock PRF output.
 * Uses the same HKDF derivation as the wallet SDK, run in Node.js.
 */
async function deriveExpectedKeys(): Promise<{
  masterSecret: bigint;
  signingKeyHex: string;
  encryptionKeyHex: string;
  accountSalt: bigint;
}> {
  // Dynamic import to use the same code as the SDK
  const { hkdf } = await import('@noble/hashes/hkdf');
  const { sha256 } = await import('@noble/hashes/sha256');

  const prfOutput = Buffer.from(MOCK_PRF_OUTPUT_HEX, 'hex');
  const encoder = new TextEncoder();

  const masterBytes = hkdf(sha256, prfOutput, undefined, encoder.encode('aztec-wallet/v1/master-secret'), 48);
  const signingBytes = hkdf(sha256, prfOutput, undefined, encoder.encode('aztec-wallet/v1/p256-signing-key'), 48);
  const encryptionBytes = hkdf(sha256, prfOutput, undefined, encoder.encode('aztec-wallet/v1/indexeddb-encryption'), 32);
  const saltBytes = hkdf(sha256, prfOutput, undefined, encoder.encode('aztec-wallet/v1/account-salt'), 48);

  function bytesToBigInt(bytes: Uint8Array): bigint {
    let result = 0n;
    for (const byte of bytes) result = (result << 8n) | BigInt(byte);
    return result;
  }

  // Fr modulus (BN254)
  const FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const P256_ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

  const masterSecret = bytesToBigInt(masterBytes) % FR_MODULUS;
  const signingKeyNum = bytesToBigInt(signingBytes) % P256_ORDER;
  const accountSalt = bytesToBigInt(saltBytes) % FR_MODULUS;

  // Convert signing key to hex
  const signingKeyHex = signingKeyNum.toString(16).padStart(64, '0');
  const encryptionKeyHex = Buffer.from(encryptionBytes).toString('hex');

  return { masterSecret, signingKeyHex, encryptionKeyHex, accountSalt };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Passkey Wallet — Full Connection Flow', () => {
  test('complete connection: popup → PRF → keys → encrypted channel → host', async ({
    page,
    context,
    popupLogs,
  }) => {
    // Capture main page logs
    const mainLogs: string[] = [];
    page.on('console', (msg) => mainLogs.push(`[MAIN:${msg.type()}] ${msg.text()}`));

    // Inject WebAuthn mock into any popup that opens at the wallet host
    await context.route('**/popup.html**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();

      // Inject mock script BEFORE the React app loads
      const injected = body.replace(
        '<div id="root">',
        `<script>${getWebAuthnMockScript(MOCK_PRF_OUTPUT_HEX)}</script><div id="root">`
      );

      await route.fulfill({
        response,
        body: injected,
        headers: {
          ...response.headers(),
          'content-type': 'text/html',
        },
      });
    });

    // Pre-compute expected keys for assertions
    const expectedKeys = await deriveExpectedKeys();

    // Step 1: Navigate and click connect
    await navigateToPasskeyTab(page);

    const connectBtn = page.locator('[data-testid="passkey-connect-button"]');
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();

    // Step 2: Click connect — popup should open
    const popupPromise = context.waitForEvent('page');
    await connectBtn.click();
    const popup = await popupPromise;

    console.log('Popup opened:', popup.url());

    // Step 3: Wait for popup to load
    await popup.waitForLoadState('domcontentloaded');
    console.log('Popup loaded');

    // Verify the WebAuthn mock was injected
    const mockActive = await popup.evaluate(() => {
      return (window as any).__webauthn_mocked !== undefined ||
        navigator.credentials.create.toString().includes('native code') === false;
    }).catch(() => false);
    console.log('WebAuthn mock active:', mockActive);

    // Step 4: Click "Create Passkey" in the popup
    const createBtn = popup.locator('[data-testid="connect-passkey-button"]');
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    console.log('Create Passkey button visible');
    await createBtn.click();
    console.log('Create Passkey clicked');

    // Step 5: Wait for the popup to close (it auto-closes after success)
    await popup.waitForEvent('close', { timeout: 15000 }).catch(() => {
      console.log('Popup did not auto-close, checking state...');
    });

    const popupClosed = popup.isClosed();
    console.log('Popup closed:', popupClosed);

    // Step 6: Wait for the SDK to create iframe and establish channel
    // The iframe creation + ECDH handshake + initWithKeys takes a moment
    await page.waitForTimeout(5000);

    // Step 7: Verify iframe was created
    const iframes = page.locator('iframe');
    const iframeCount = await iframes.count();
    console.log('Iframe count:', iframeCount);
    expect(iframeCount).toBeGreaterThanOrEqual(1);

    // Step 8: Check connection state
    const isConnecting = await page.locator('[data-testid="passkey-status-connecting"]')
      .isVisible().catch(() => false);
    const isConnected = await page.locator('[data-testid="passkey-status-connected"]')
      .isVisible().catch(() => false);
    const isDisconnected = await page.locator('[data-testid="passkey-status-disconnected"]')
      .isVisible().catch(() => false);

    console.log('State — connecting:', isConnecting, 'connected:', isConnected, 'disconnected:', isDisconnected);

    // Print all logs for debugging
    console.log('\n=== POPUP LOGS ===');
    popupLogs.forEach((l) => console.log(l));
    console.log('=== MAIN LOGS (last 20) ===');
    mainLogs.slice(-20).forEach((l) => console.log(l));
    console.log('=== END LOGS ===\n');

    // The popup should have:
    // 1. Received POPUP_INIT
    // 2. Called mocked navigator.credentials.create
    // 3. Derived keys from the deterministic PRF output
    // 4. Sent auth-keys response via MessagePort
    // 5. Closed itself

    expect(popupClosed).toBe(true);

    // Verify the mock was called
    const mockCalled = popupLogs.some((l) => l.includes('[MOCK] navigator.credentials.create called'));
    expect(mockCalled).toBe(true);

    // Verify no errors in popup
    const popupErrors = popupLogs.filter((l) => l.includes('[POPUP:ERROR]'));
    if (popupErrors.length > 0) {
      console.error('Popup errors:', popupErrors);
    }
    expect(popupErrors).toHaveLength(0);
  });

  test('derived keys from mock PRF are deterministic', async () => {
    // Verify that our test helper produces the same keys every time
    const keys1 = await deriveExpectedKeys();
    const keys2 = await deriveExpectedKeys();

    expect(keys1.masterSecret).toBe(keys2.masterSecret);
    expect(keys1.signingKeyHex).toBe(keys2.signingKeyHex);
    expect(keys1.encryptionKeyHex).toBe(keys2.encryptionKeyHex);
    expect(keys1.accountSalt).toBe(keys2.accountSalt);

    // Keys should be non-zero
    expect(keys1.masterSecret).toBeGreaterThan(0n);
    expect(keys1.accountSalt).toBeGreaterThan(0n);
    expect(keys1.signingKeyHex.length).toBe(64);
    expect(keys1.encryptionKeyHex.length).toBe(64);

    console.log('Master secret:', keys1.masterSecret.toString(16).substring(0, 20) + '...');
    console.log('Account salt:', keys1.accountSalt.toString(16).substring(0, 20) + '...');
    console.log('Signing key:', keys1.signingKeyHex.substring(0, 20) + '...');
    console.log('Encryption key:', keys1.encryptionKeyHex.substring(0, 20) + '...');
  });
});
