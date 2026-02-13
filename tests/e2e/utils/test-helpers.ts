/**
 * Shared E2E Test Helpers
 *
 * Common utilities used across E2E tests for wallet connection,
 * network switching, and browser storage management.
 */

import { expect, type Page } from '@playwright/test';

/** Timeout constants for E2E tests */
export const TIMEOUTS = {
  SHORT: 5000,
  DEFAULT: 30000,
  LONG: 60000,
  WALLET_OPERATION: 120000,
} as const;

/**
 * Clears all browser storage (IndexedDB, localStorage, sessionStorage)
 * Call this before tests to ensure a clean state.
 */
export async function clearBrowserStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Switches the app to Sandbox network via the network picker.
 */
export async function switchToSandbox(page: Page): Promise<void> {
  const networkPicker = page.locator('[data-testid="network-picker"]');
  await expect(networkPicker).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
  await networkPicker.click();

  const networkModal = page.locator('[data-testid="network-modal"]');
  await expect(networkModal).toBeVisible({ timeout: TIMEOUTS.SHORT });

  const sandboxOption = networkModal.locator(
    '[data-testid="network-option-sandbox"]'
  );
  await sandboxOption.click();
  console.log('Sandbox network selected');

  await expect(networkModal).not.toBeVisible({ timeout: TIMEOUTS.SHORT });
}

/**
 * Opens the wallet connect modal.
 * @returns The modal locator for further interactions
 */
export async function openConnectModal(page: Page) {
  const connectBtn = page.locator('[data-testid="connect-wallet-button"]');
  await expect(connectBtn).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
  await connectBtn.click();

  const modal = page.locator('[data-testid="connect-wallet-modal"]');
  await expect(modal).toBeVisible({ timeout: TIMEOUTS.SHORT });

  return modal;
}

/**
 * Connects via EVM wallet (MetaMask) after switching to Sandbox network.
 */
export async function connectViaEVMWallet(page: Page): Promise<void> {
  await switchToSandbox(page);

  const modal = await openConnectModal(page);

  const evmWalletGroup = modal.locator('[data-testid="wallet-group-evm"]');
  await expect(evmWalletGroup).toBeVisible({ timeout: TIMEOUTS.SHORT });
  await evmWalletGroup.click();

  const metamaskBtn = modal.locator('[data-testid="wallet-button-metamask"]');
  await expect(metamaskBtn).toBeVisible({ timeout: 10000 });
  await metamaskBtn.click();
  console.log('MetaMask button clicked, waiting for wallet connection...');

  await expect(modal).not.toBeVisible({ timeout: TIMEOUTS.WALLET_OPERATION });
  console.log('Wallet connected');

  const accountSection = page.locator('[data-testid="connected-account"]');
  await expect(accountSection).toBeVisible({
    timeout: TIMEOUTS.WALLET_OPERATION,
  });
}

/**
 * Connects via Embedded wallet after switching to Sandbox network.
 */
export async function connectViaEmbeddedWallet(page: Page): Promise<void> {
  await switchToSandbox(page);

  const modal = await openConnectModal(page);

  const embeddedGroup = modal.locator('[data-testid="wallet-group-embedded"]');
  await expect(embeddedGroup).toBeVisible({ timeout: TIMEOUTS.SHORT });
  await embeddedGroup.click();
  console.log('Embedded Wallet clicked, waiting for account creation...');

  await expect(modal).not.toBeVisible({ timeout: TIMEOUTS.WALLET_OPERATION });
  console.log('Account created and connected');

  const accountSection = page.locator('[data-testid="connected-account"]');
  await expect(accountSection).toBeVisible({
    timeout: TIMEOUTS.WALLET_OPERATION,
  });
}
