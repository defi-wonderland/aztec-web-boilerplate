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

    // Click "Connect Wallet"
    const connectBtn = page.locator('[data-testid="connect-wallet-button"]');
    await expect(connectBtn).toBeVisible({ timeout: 30000 });
    await connectBtn.click();

    // Wait for modal
    const modal = page.locator('[data-testid="connect-wallet-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Select sandbox network using Radix Select
    const networkTrigger = modal.locator('[data-testid="network-selector"]');
    await networkTrigger.click();
    const sandboxOption = page.locator('[role="option"]').filter({ hasText: 'Sandbox' });
    await sandboxOption.click();

    // Wait for network to be ready (idle or connected state)
    const networkStatus = modal.locator('[data-testid="network-status"]');
    await expect(networkStatus).toContainText(/ready to connect|connected/, { timeout: 120000 });
    console.log('Sandbox network ready');

    // Click MetaMask connect button
    const metamaskBtn = modal.locator('button:has-text("MetaMask")');
    await expect(metamaskBtn).toBeEnabled({ timeout: 10000 });
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
