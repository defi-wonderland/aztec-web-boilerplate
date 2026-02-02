/**
 * E2E Test: Wallet Connection with Walletless
 *
 * Uses the walletless fixture for clean MetaMask simulation.
 * Requires Aztec sandbox running.
 */

import { test, expect, ANVIL_ACCOUNTS } from './fixtures/walletless';

test.describe('Wallet Connection E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB and storage
    await page.goto('/');
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should connect MetaMask wallet via walletless', async ({
    page,
    walletless,
  }) => {
    console.log('\n=== E2E: MetaMask Wallet Connection ===\n');
    console.log('Test account:', walletless.account.address);

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click network picker to change network to Sandbox
    const networkPicker = page.locator('[data-testid="network-picker"]');
    await expect(networkPicker).toBeVisible({ timeout: 30000 });
    await networkPicker.click();

    // Wait for network modal
    const networkModal = page.locator('[data-testid="network-modal"]');
    await expect(networkModal).toBeVisible({ timeout: 5000 });

    // Select Sandbox network
    const sandboxOption = networkModal.locator('[data-testid="network-option-sandbox"]');
    await sandboxOption.click();
    console.log('Sandbox network selected');

    // Wait for network modal to close
    await expect(networkModal).not.toBeVisible({ timeout: 5000 });

    // Click "Connect Wallet"
    const connectBtn = page.locator('[data-testid="connect-wallet-button"]');
    await expect(connectBtn).toBeVisible({ timeout: 30000 });
    await connectBtn.click();

    // Wait for modal
    const modal = page.locator('[data-testid="connect-wallet-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click "EVM Wallet" group to see EVM wallets list
    const evmWalletGroup = modal.locator('[data-testid="wallet-group-evm"]');
    await expect(evmWalletGroup).toBeVisible({ timeout: 5000 });
    await evmWalletGroup.click();
    console.log('EVM Wallet group clicked');

    // Click MetaMask button
    const metamaskBtn = modal.locator('[data-testid="wallet-button-metamask"]');
    await expect(metamaskBtn).toBeVisible({ timeout: 10000 });
    await metamaskBtn.click();
    console.log('MetaMask button clicked, waiting for signature...');

    // Wait for modal to close (connection complete)
    await expect(modal).not.toBeVisible({ timeout: 120000 });

    // Verify connected account is displayed
    const accountSection = page.locator('[data-testid="connected-account"]');
    await expect(accountSection).toBeVisible({ timeout: 120000 });

    const accountAddress = page.locator('[data-testid="account-address"]');
    const displayedAddress = await accountAddress.textContent();
    console.log('Connected:', displayedAddress);

    console.log('\n=== TEST PASSED ===\n');
  });

  test('should have walletless provider injected', async ({
    page,
    walletless,
  }) => {
    await page.goto('/');

    // Verify walletless is injected
    const hasWalletless = await page.evaluate(() => {
      return !!(window as any).ethereum?.isWalletless;
    });
    expect(hasWalletless).toBe(true);

    // Verify correct account
    const accounts = await page.evaluate(async () => {
      return (window as any).ethereum.request({ method: 'eth_accounts' });
    });
    expect(accounts[0].toLowerCase()).toBe(
      walletless.account.address.toLowerCase()
    );
  });
});
