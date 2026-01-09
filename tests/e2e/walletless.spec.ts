/**
 * E2E Test: Wallet Connection with Walletless Provider
 *
 * Tests the MetaMask connection flow using @wonderland/walletless
 * to simulate MetaMask signing. Requires Aztec sandbox running.
 */

import { test, expect } from '@playwright/test';
import { createE2EProvider, ANVIL_ACCOUNTS } from '@wonderland/walletless';
import { defineChain } from 'viem';

// Local Anvil chain (chainId 31337 = 0x7a69)
const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

// Anvil test account
const TEST_ACCOUNT = ANVIL_ACCOUNTS[0];

// Create walletless E2E provider at module level (shared across tests)
const provider = createE2EProvider({
  chains: [anvil],
  rpcUrls: { 31337: 'http://127.0.0.1:8545' },
  account: TEST_ACCOUNT.privateKey,
  debug: true,
});

test.describe('Wallet Connection E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage
    await context.clearCookies();

    // Navigate first to have a page context, then clear storage
    await page.goto('/');
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
      localStorage.clear();
      sessionStorage.clear();
    });

    // Capture browser console logs for debugging
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log(`[BROWSER ERROR] ${text}`);
      } else if (
        text.includes('[walletless]') ||
        text.includes('DEBUG') ||
        text.includes('Error')
      ) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    // Capture page errors
    page.on('pageerror', (err) => {
      console.log(`[PAGE ERROR] ${err.message}`);
    });

    // Expose signing functions to the browser
    await page.exposeFunction('__signMessage__', async (message: string) => {
      console.log('[walletless] Signing message...');
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, TEST_ACCOUNT.address],
      });
      console.log('[walletless] Signature:', signature);
      return signature;
    });

    await page.exposeFunction(
      '__signTypedData__',
      async (typedDataJson: string) => {
        console.log('[walletless] Signing typed data...');
        const signature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [TEST_ACCOUNT.address, typedDataJson],
        });
        console.log('[walletless] Signature:', signature);
        return signature;
      }
    );

    // Inject minimal ethereum provider that delegates signing to Node.js
    await page.addInitScript({
      content: `
        window.ethereum = {
          isMetaMask: true,
          chainId: '0x7a69',
          selectedAddress: '${TEST_ACCOUNT.address}',

          request: async ({ method, params }) => {
            console.log('[walletless] Request:', method);

            switch (method) {
              case 'eth_requestAccounts':
              case 'eth_accounts':
                return ['${TEST_ACCOUNT.address}'];

              case 'eth_chainId':
                return '0x7a69';

              case 'personal_sign':
              case 'eth_sign': {
                const message = params[0];
                return await window.__signMessage__(message);
              }

              case 'eth_signTypedData':
              case 'eth_signTypedData_v3':
              case 'eth_signTypedData_v4': {
                const typedData = typeof params[1] === 'string'
                  ? params[1]
                  : JSON.stringify(params[1]);
                return await window.__signTypedData__(typedData);
              }

              case 'wallet_switchEthereumChain':
              case 'wallet_addEthereumChain':
                return null;

              default:
                console.warn('[walletless] Unhandled method:', method);
                throw new Error('Method not supported: ' + method);
            }
          },

          on: () => {},
          removeListener: () => {},
        };
        console.log('[walletless] Provider injected with account: ${TEST_ACCOUNT.address}');
      `,
    });
  });

  test('should connect MetaMask wallet via walletless', async ({ page }) => {
    console.log('\n========== E2E TEST: MetaMask Wallet Connection ==========\n');

    // Step 1: Navigate and wait for app to load
    console.log('[TEST] Navigating to app...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('[TEST] App loaded');

    // Step 2: Click "Connect Wallet" button
    console.log('[TEST] Clicking "Connect Wallet"...');
    const connectWalletBtn = page.locator('.wallet-connect-button');
    await expect(connectWalletBtn).toBeVisible({ timeout: 30000 });
    await connectWalletBtn.click();

    // Step 3: Wait for modal to appear
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log('[TEST] Modal opened');

    // Step 4: Select sandbox network
    console.log('[TEST] Selecting sandbox network...');
    const networkSelect = page.locator('#modal-network-selector');
    await networkSelect.selectOption('sandbox');

    // Step 5: Wait for network to initialize (shows "connected" in status)
    console.log('[TEST] Waiting for sandbox network to connect...');
    const networkStatus = page.locator('.network-status');
    await expect(networkStatus).toContainText('connected', { timeout: 120000 });
    console.log('[TEST] Sandbox network connected');

    // Step 6: Click "Connect MetaMask" button
    console.log('[TEST] Clicking "Connect MetaMask"...');
    const connectMetaMaskBtn = modal.locator(
      'button:has-text("Connect MetaMask"), button:has-text("MetaMask")'
    );
    await expect(connectMetaMaskBtn).toBeEnabled({ timeout: 10000 });
    await connectMetaMaskBtn.click();

    // Step 7: Wait for public key generation (signature request via walletless)
    // This triggers personal_sign to derive the ECDSA public key
    console.log('[TEST] Waiting for public key generation...');

    // The modal should close after successful connection
    await expect(modal).not.toBeVisible({ timeout: 120000 });
    console.log('[TEST] Modal closed - connection initiated');

    // Step 8: Verify wallet is connected (account display visible in header)
    console.log('[TEST] Verifying wallet connection...');
    const accountDisplay = page.locator('.connected-account-section');
    await expect(accountDisplay).toBeVisible({ timeout: 120000 });
    console.log('[TEST] Wallet connected successfully!');

    // Verify the displayed address contains the expected format
    const accountAddress = page.locator('.account-address');
    await expect(accountAddress).toBeVisible();
    const addressText = await accountAddress.textContent();
    console.log('[TEST] Connected account:', addressText);

    console.log('\n========== TEST PASSED ==========\n');
  });
});
