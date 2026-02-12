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
} as const;

/**
 * Switches the app to Sandbox network via the network picker.
 * Uses :visible filter because the Header renders separate desktop/mobile layouts.
 */
export async function switchToSandbox(page: Page): Promise<void> {
  const networkPicker = page
    .locator('[data-testid="network-picker"]:visible')
    .first();
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
 * Uses :visible filter because the Header renders separate desktop/mobile ConnectButtons.
 * @returns The modal locator for further interactions
 */
export async function openConnectModal(page: Page) {
  const connectBtn = page
    .locator('[data-testid="connect-wallet-button"]:visible')
    .first();
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

  await expect(modal).not.toBeVisible({ timeout: TIMEOUTS.LONG });
  console.log('Wallet connected');

  const accountSection = page
    .locator('[data-testid="connected-account"]:visible')
    .first();
  await expect(accountSection).toBeVisible({
    timeout: TIMEOUTS.LONG,
  });
}

/**
 * Connects via Embedded wallet after switching to Sandbox network.
 * Forwards browser console logs to test output for CI debugging.
 */
export async function connectViaEmbeddedWallet(page: Page): Promise<void> {
  await switchToSandbox(page);

  // Forward browser console logs for debugging embedded account flow
  const browserLogs: string[] = [];
  const logListener = (msg: import('@playwright/test').ConsoleMessage) => {
    const text = msg.text();
    if (
      text.includes('[embedded-account]') ||
      text.includes('[deploy-account]')
    ) {
      console.log(`[browser] ${text}`);
      browserLogs.push(text);
    }
  };
  page.on('console', logListener);

  const modal = await openConnectModal(page);

  const embeddedGroup = modal.locator('[data-testid="wallet-group-embedded"]');
  await expect(embeddedGroup).toBeVisible({ timeout: TIMEOUTS.SHORT });
  await embeddedGroup.click();
  console.log('Embedded Wallet clicked, waiting for account creation...');

  try {
    await expect(modal).not.toBeVisible({ timeout: TIMEOUTS.LONG });
  } catch {
    // Dump all captured browser logs on failure
    console.error('--- Browser logs (embedded-account) ---');
    browserLogs.forEach((log) => console.error(log));
    console.error('--- End browser logs ---');

    // Capture error displayed in modal
    const errorEl = modal.locator('.text-red-500').first();
    const errorText = await errorEl
      .textContent({ timeout: 2000 })
      .catch(() => null);
    console.error('Modal error:', errorText ?? '(no error element found)');

    throw new Error(
      `Embedded wallet modal stayed open. Error: ${errorText ?? 'unknown'}. See browser logs above.`
    );
  } finally {
    page.off('console', logListener);
  }

  console.log('Account created and connected');

  const accountSection = page
    .locator('[data-testid="connected-account"]:visible')
    .first();
  await expect(accountSection).toBeVisible({
    timeout: TIMEOUTS.LONG,
  });
}
