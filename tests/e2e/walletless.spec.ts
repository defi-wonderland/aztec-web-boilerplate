/**
 * E2E Test: Wallet Connection with Walletless
 *
 * Uses the walletless fixture for clean MetaMask simulation.
 * Requires Aztec sandbox running.
 */

import { test, expect } from './fixtures/walletless';
import {
  clearBrowserStorage,
  switchToSandbox,
  openConnectModal,
  TIMEOUTS,
} from './utils/test-helpers';

test.describe('Wallet Connection E2E', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserStorage(page);
  });

  test('should connect MetaMask wallet via walletless', async ({
    page,
    walletless,
  }) => {
    console.log('\n=== E2E: MetaMask Wallet Connection ===\n');
    console.log('Test account:', walletless.account.address);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await switchToSandbox(page);

    const modal = await openConnectModal(page);

    const evmWalletGroup = modal.locator('[data-testid="wallet-group-evm"]');
    await expect(evmWalletGroup).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await evmWalletGroup.click();
    console.log('EVM Wallet group clicked');

    const metamaskBtn = modal.locator('[data-testid="wallet-button-metamask"]');
    await expect(metamaskBtn).toBeVisible({ timeout: 10000 });
    await metamaskBtn.click();
    console.log('MetaMask button clicked, waiting for signature...');

    await expect(modal).not.toBeVisible({ timeout: TIMEOUTS.WALLET_OPERATION });

    const accountSection = page.locator('[data-testid="connected-account"]');
    await expect(accountSection).toBeVisible({
      timeout: TIMEOUTS.WALLET_OPERATION,
    });

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

    const hasWalletless = await page.evaluate(() => {
      return !!(window as unknown as { ethereum?: { isWalletless?: boolean } })
        .ethereum?.isWalletless;
    });
    expect(hasWalletless).toBe(true);

    const accounts = await page.evaluate(async () => {
      return (
        window as unknown as {
          ethereum: {
            request: (args: { method: string }) => Promise<string[]>;
          };
        }
      ).ethereum.request({ method: 'eth_accounts' });
    });
    expect(accounts[0].toLowerCase()).toBe(
      walletless.account.address.toLowerCase()
    );
  });
});
