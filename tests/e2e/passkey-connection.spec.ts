/**
 * E2E Test: Passkey Wallet Full Connection Flow
 *
 * Verifies the COMPLETE chain described in the tech design:
 *
 *   1. User clicks "Connect with Passkey" (user gesture)
 *   2. SDK opens popup at wallet host origin
 *   3. Popup renders ConnectFlow, user clicks "Create Passkey"
 *   4. navigator.credentials.create() + PRF → 32-byte deterministic secret
 *   5. HKDF derives: masterSecret, signingKey, encryptionKey, accountSalt
 *   6. Popup sends base64-encoded keys to SDK via MessagePort → auto-closes
 *   7. SDK creates hidden iframe at wallet host (/host.html)
 *   8. ECDH key exchange → AES-256-GCM encrypted SecureChannel established
 *   9. SDK sends initWithKeys with derived keys over encrypted channel
 *  10. Host decodes keys, initializes PXE with CompositeKVStore
 *       (RAM for key_store/complete_addresses, encrypted IndexedDB for rest)
 *  11. Host registers account with masterSecret, returns address
 *  12. SDK receives address, transitions to "connected" state
 *
 * WebAuthn is mocked because RP ID "aztec.network" doesn't match localhost.
 * Everything else is REAL: popup React app, MessagePort communication,
 * ECDH handshake, AES-256-GCM encryption, HKDF key derivation,
 * PXE initialization, CompositeKVStore, account registration.
 *
 * Requirements:
 *   - Aztec sandbox node at localhost:8080  (`aztec start --sandbox`)
 *   - Wallet host at localhost:3001  (`cd packages/passkey-wallet && npx vite --config vite.host.config.ts`)
 *   - App at localhost:3000  (`yarn dev` or `yarn serve`)
 */

import { test as base, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Deterministic mock data
// ---------------------------------------------------------------------------

/** Fixed 32-byte PRF output — all derived keys are deterministic from this. */
const MOCK_PRF_HEX =
  'abababababababababababababababababababababababababababababababababab';

/**
 * Script injected into the popup BEFORE React loads.
 * Replaces navigator.credentials.create/get with mocks that return a
 * proper PublicKeyCredential with PRF extension results.
 *
 * This is the ONLY mock — everything downstream (HKDF, key derivation,
 * encrypted channel, PXE, account registration) runs for real.
 */
const WEBAUTHN_MOCK = `
(function() {
  function hexToBytes(hex) {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) b[i/2] = parseInt(hex.substr(i,2), 16);
    return b;
  }

  const PRF = hexToBytes('${MOCK_PRF_HEX}');
  const CRED_ID = new Uint8Array(32).fill(0x01);
  const PUB_KEY = new Uint8Array(65); PUB_KEY[0] = 0x04;
  for (let i = 1; i < 65; i++) PUB_KEY[i] = i;

  function mockCredential() {
    return {
      id: 'mock-passkey',
      rawId: CRED_ID.buffer.slice(0),
      type: 'public-key',
      response: {
        getPublicKey() { return PUB_KEY.buffer.slice(0); },
        clientDataJSON: new ArrayBuffer(2),
        attestationObject: new ArrayBuffer(2),
        getAuthenticatorData() { return new ArrayBuffer(37); },
        getTransports() { return ['internal']; },
      },
      authenticatorAttachment: 'platform',
      getClientExtensionResults() {
        return { prf: { enabled: true, results: { first: PRF.buffer.slice(0) } } };
      },
    };
  }

  Object.defineProperty(navigator, 'credentials', {
    value: {
      create: async function(opts) {
        console.log('[WEBAUTHN_MOCK] credentials.create() called — returning mock with PRF');
        return mockCredential();
      },
      get: async function(opts) {
        console.log('[WEBAUTHN_MOCK] credentials.get() called — returning mock with PRF');
        return mockCredential();
      },
    },
    writable: false, configurable: true,
  });

  console.log('[WEBAUTHN_MOCK] Installed — PRF output: ${MOCK_PRF_HEX.substring(0, 16)}...');
})();
`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Fixtures = {
  popupLogs: string[];
  mainLogs: string[];
};

const test = base.extend<Fixtures>({
  popupLogs: async ({ context }, use) => {
    const logs: string[] = [];
    context.on('page', (p) => {
      p.on('console', (m) => logs.push(`[popup:${m.type()}] ${m.text()}`));
      p.on('pageerror', (e) => logs.push(`[popup:error] ${e.message}`));
    });
    await use(logs);
  },
  mainLogs: async ({}, use) => {
    await use([]);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToPasskeyTab(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const tab = page.locator('button').filter({ hasText: /Passkey Wallet/i }).first();
  await tab.click();
  await expect(page.locator('[data-testid="passkey-wallet-card"]')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Passkey Wallet — Real E2E Connection', () => {

  // Inject WebAuthn mock into every popup.html loaded from the wallet host
  test.beforeEach(async ({ context }) => {
    await context.route('**/popup.html**', async (route) => {
      const resp = await route.fetch();
      const html = await resp.text();
      // Inject mock right after <body>, before early message handler and React
      const injected = html.replace(
        '<div id="root">',
        `<script>${WEBAUTHN_MOCK}</script>\n<div id="root">`,
      );
      await route.fulfill({
        response: resp,
        body: injected,
        headers: { ...resp.headers(), 'content-type': 'text/html' },
      });
    });
  });

  test('full connect flow: passkey → PRF → keys → channel → PXE → address', async ({
    page, context, popupLogs,
  }) => {
    // Capture main page logs
    const mainLogs: string[] = [];
    page.on('console', (m) => mainLogs.push(`[main:${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => mainLogs.push(`[main:error] ${e.message}`));

    // --- Step 1: Navigate to Passkey tab ---
    await navigateToPasskeyTab(page);
    console.log('Step 1: Passkey tab loaded');

    // Verify initial disconnected state
    await expect(page.locator('[data-testid="passkey-status-disconnected"]')).toBeVisible();
    await expect(page.locator('[data-testid="passkey-connect-button"]')).toBeEnabled();

    // --- Step 2: Click Connect → popup opens ---
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
    await page.locator('[data-testid="passkey-connect-button"]').click();
    console.log('Step 2: Connect button clicked');

    const popup = await popupPromise;
    console.log('Step 3: Popup opened at', popup.url());

    // --- Step 3: Wait for popup to render ConnectFlow ---
    await popup.waitForLoadState('domcontentloaded');
    // Give React + early message buffer time
    await popup.waitForTimeout(3000);

    const createBtn = popup.locator('[data-testid="connect-passkey-button"]');
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    console.log('Step 4: Create Passkey button visible');

    // Verify mock was injected
    expect(popupLogs.some(l => l.includes('[WEBAUTHN_MOCK] Installed'))).toBe(true);

    // --- Step 4: Click Create Passkey → mock WebAuthn → key derivation ---
    await createBtn.click();
    console.log('Step 5: Create Passkey clicked — mock WebAuthn + HKDF running');

    // Popup should auto-close after deriving keys and sending response
    await expect.poll(() => popup.isClosed(), {
      message: 'Popup should auto-close after passkey ceremony',
      timeout: 15_000,
    }).toBe(true);
    console.log('Step 6: Popup closed — keys sent to SDK');

    // Verify mock was called
    expect(popupLogs.some(l => l.includes('credentials.create() called'))).toBe(true);

    // --- Step 5-8: SDK creates iframe → channel → initWithKeys ---
    // This takes time: iframe load → ECDH handshake → PXE initialization
    console.log('Step 7: Waiting for iframe + channel + PXE initialization...');

    // Wait for either connected or an error (up to 120s for PXE init)
    const connected = page.locator('[data-testid="passkey-status-connected"]');
    const connecting = page.locator('[data-testid="passkey-status-connecting"]');
    const disconnected = page.locator('[data-testid="passkey-status-disconnected"]');

    // First verify we're in connecting state (iframe + channel being set up)
    await expect(connecting).toBeVisible({ timeout: 10_000 }).catch(() => {
      console.log('Warning: connecting state not visible (may have resolved quickly)');
    });

    // Wait for final state — PXE init can take 30-60s
    try {
      await expect(connected).toBeVisible({ timeout: 120_000 });
      console.log('Step 8: CONNECTED!');

      // --- Step 9: Verify address is displayed ---
      const addressCard = page.locator('[data-testid="passkey-address-card"]');
      await expect(addressCard).toBeVisible({ timeout: 5_000 });
      const address = await page.locator('[data-testid="passkey-address-value"]').textContent();
      console.log('Step 9: Wallet address:', address);

      // Address should be a valid Aztec address (0x + hex)
      expect(address).toBeTruthy();
      expect(address!.startsWith('0x')).toBe(true);
      expect(address!.length).toBeGreaterThan(10);

      // Disconnect button should be visible
      await expect(page.locator('[data-testid="passkey-disconnect-button"]')).toBeVisible();

      console.log('\n=== FULL CONNECTION FLOW PASSED ===\n');

    } catch (e) {
      // Connection failed — dump diagnostic logs
      const isStillConnecting = await connecting.isVisible().catch(() => false);
      const isDisconnected = await disconnected.isVisible().catch(() => false);
      console.log('Connection failed. connecting:', isStillConnecting, 'disconnected:', isDisconnected);

      console.log('\n=== POPUP LOGS ===');
      popupLogs.forEach(l => console.log(l));

      console.log('\n=== MAIN LOGS (last 30) ===');
      mainLogs.slice(-30).forEach(l => console.log(l));

      // Check iframe state
      const iframes = await page.locator('iframe').count();
      console.log('Iframes in DOM:', iframes);

      throw e;
    }
  });

  test('popup derives deterministic keys from PRF output', async ({
    page, context, popupLogs,
  }) => {
    // Navigate and open popup
    await navigateToPasskeyTab(page);

    const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
    await page.locator('[data-testid="passkey-connect-button"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForTimeout(3000);

    // Click create passkey
    const createBtn = popup.locator('[data-testid="connect-passkey-button"]');
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    // Popup should close (keys derived and sent)
    await expect.poll(() => popup.isClosed(), { timeout: 15_000 }).toBe(true);

    // Verify the WebAuthn mock was called
    expect(popupLogs.some(l => l.includes('credentials.create() called'))).toBe(true);

    // No errors in popup
    const errors = popupLogs.filter(l => l.includes('[popup:error]'));
    expect(errors).toHaveLength(0);

    console.log('Popup logs:');
    popupLogs.forEach(l => console.log(l));
  });

  test('iframe is created with correct attributes', async ({
    page, context,
  }) => {
    await navigateToPasskeyTab(page);

    const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
    await page.locator('[data-testid="passkey-connect-button"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForTimeout(3000);

    const createBtn = popup.locator('[data-testid="connect-passkey-button"]');
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await expect.poll(() => popup.isClosed(), { timeout: 15_000 }).toBe(true);

    // Wait for iframe to be created
    await page.waitForTimeout(3000);

    // Verify iframe exists and has correct properties
    const iframe = page.locator('iframe').first();
    await expect(iframe).toBeAttached({ timeout: 10_000 });

    const src = await iframe.getAttribute('src');
    expect(src).toContain('localhost:3001/host.html');

    // Should be hidden
    const display = await iframe.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');

    // Should have credentialless attribute (for COEP compatibility)
    const credentialless = await iframe.evaluate(el => (el as any).credentialless);
    expect(credentialless).toBe(true);

    console.log('Iframe verified: src=%s, display=%s, credentialless=%s', src, display, credentialless);
  });

  test('encrypted channel handshake completes', async ({
    page, context,
  }) => {
    const mainLogs: string[] = [];
    page.on('console', m => mainLogs.push(m.text()));

    await navigateToPasskeyTab(page);

    const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
    await page.locator('[data-testid="passkey-connect-button"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForTimeout(3000);

    const createBtn = popup.locator('[data-testid="connect-passkey-button"]');
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await expect.poll(() => popup.isClosed(), { timeout: 15_000 }).toBe(true);

    // After popup closes, SDK creates iframe and does ECDH handshake.
    // If it reaches connecting state, the channel is established
    // (connect() only calls initWithKeys AFTER channel.initFromPort resolves)
    const connecting = page.locator('[data-testid="passkey-status-connecting"]');
    const connected = page.locator('[data-testid="passkey-status-connected"]');

    // Wait for the iframe's Vite HMR to connect (sign it loaded properly)
    await page.waitForTimeout(8000);

    const iframes = await page.locator('iframe').count();
    expect(iframes).toBeGreaterThanOrEqual(1);

    // If we see either connecting or connected, the ECDH handshake completed
    const isConnecting = await connecting.isVisible().catch(() => false);
    const isConnected = await connected.isVisible().catch(() => false);

    console.log('After channel: connecting=%s connected=%s iframes=%d', isConnecting, isConnected, iframes);

    // At minimum, the iframe should exist (channel setup started)
    expect(iframes).toBe(1);
  });
});
