/**
 * E2E Test: Mint to Public Balance
 *
 * Tests the minting functionality for both:
 * 1. Walletless (MetaMask simulation via @wonderland/walletless)
 * 2. Embedded wallet (Create New Account)
 *
 * Completion criteria: Public balance increases after minting
 */

import { test as baseTest } from '@playwright/test';
import { test, expect } from './fixtures/walletless';
import {
  clearBrowserStorage,
  connectViaEVMWallet,
  connectViaEmbeddedWallet,
  TIMEOUTS,
} from './utils/test-helpers';
import type { Page } from '@playwright/test';

const MINT_AMOUNT = '1';

/**
 * Helper to get current public balance from the UI
 */
async function getPublicBalance(page: Page): Promise<bigint> {
  const balanceCard = page.locator('[data-testid="token-balance-card"]');
  await expect(balanceCard).toBeVisible({ timeout: TIMEOUTS.DEFAULT });

  const loadingSpinner = page.locator('[data-testid="balance-loading"]');
  if (await loadingSpinner.isVisible()) {
    await expect(loadingSpinner).not.toBeVisible({ timeout: TIMEOUTS.LONG });
  }

  const balanceValue = page.locator('[data-testid="balance-value-public"]');
  await expect(balanceValue).toBeVisible({ timeout: 10000 });

  const balanceText = await balanceValue.textContent();
  return BigInt(balanceText?.trim() || '0');
}

/**
 * Helper to wait for balance to sync after minting
 */
async function waitForBalanceSync(
  page: Page,
  expectedMinimum: bigint,
  timeout = TIMEOUTS.WALLET_OPERATION
): Promise<bigint> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const balance = await getPublicBalance(page);
    if (balance >= expectedMinimum) {
      return balance;
    }
    await page.waitForTimeout(2000);

    const refetchBadge = page.locator('[data-testid="balance-syncing"]');
    if (await refetchBadge.isVisible()) {
      await expect(refetchBadge).not.toBeVisible({ timeout: TIMEOUTS.DEFAULT });
    }
  }

  throw new Error(
    `Balance did not reach expected minimum ${expectedMinimum} within ${timeout}ms`
  );
}

/**
 * Helper to mint tokens to public balance
 */
async function mintToPublic(page: Page, amount: string): Promise<void> {
  const dripperContent = page.locator('[data-testid="dripper-form"]');
  await expect(dripperContent).toBeVisible({ timeout: TIMEOUTS.LONG });

  const loadingSpinner = dripperContent.locator('.animate-spin');
  if (await loadingSpinner.isVisible()) {
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.WALLET_OPERATION,
    });
  }

  const amountInput = page.locator('#amount');
  await expect(amountInput).toBeVisible({ timeout: 10000 });
  await expect(amountInput).toBeEnabled({ timeout: 10000 });
  await amountInput.fill(amount);

  const dripTypeTrigger = page.locator('#drip-type');
  await expect(dripTypeTrigger).toBeEnabled({ timeout: 10000 });
  await dripTypeTrigger.click();
  const publicOption = page
    .locator('[role="option"]')
    .filter({ hasText: 'Public' });
  await publicOption.click();

  const dripButton = page.locator('[data-testid="drip-button"]');
  await expect(dripButton).toBeVisible({ timeout: 10000 });
  await expect(dripButton).toBeEnabled({ timeout: TIMEOUTS.DEFAULT });

  await dripButton.click();
  console.log('Drip button clicked');

  await page.waitForTimeout(100);

  try {
    await expect(dripButton).toContainText('Processing', { timeout: 2000 });
    console.log('Transaction processing...');
  } catch {
    console.log(
      'Processing state too fast to catch, checking if already done...'
    );
  }

  await expect(dripButton).toContainText('Drip to', {
    timeout: TIMEOUTS.WALLET_OPERATION,
  });
  console.log('Transaction completed');
}

/**
 * Shared test logic for minting to public balance
 */
async function runMintToPublicTest(
  page: Page,
  connectFn: (page: Page) => Promise<void>,
  testName: string
): Promise<void> {
  console.log(`\n=== E2E: ${testName} ===\n`);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await connectFn(page);

  const initialBalance = await getPublicBalance(page);
  console.log('Initial public balance:', initialBalance.toString());

  console.log(`Minting ${MINT_AMOUNT} tokens to public balance...`);
  await mintToPublic(page, MINT_AMOUNT);
  console.log('Mint transaction submitted');

  const expectedMinBalance = initialBalance + BigInt(MINT_AMOUNT);
  const finalBalance = await waitForBalanceSync(page, expectedMinBalance);
  console.log('Final public balance:', finalBalance.toString());

  expect(finalBalance).toBeGreaterThanOrEqual(expectedMinBalance);
  console.log(
    `Balance increased by ${(finalBalance - initialBalance).toString()} tokens`
  );

  console.log('\n=== TEST PASSED ===\n');
}

test.describe('Mint to Public - Walletless (MetaMask)', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserStorage(page);
  });

  test('should mint tokens to public balance via walletless MetaMask', async ({
    page,
    walletless,
  }) => {
    console.log('Test account:', walletless.account.address);
    await runMintToPublicTest(
      page,
      connectViaEVMWallet,
      'Mint to Public via Walletless'
    );
  });
});

baseTest.describe(
  'Mint to Public - Embedded Wallet (Create New Account)',
  () => {
    baseTest.beforeEach(async ({ page }) => {
      await clearBrowserStorage(page);
    });

    baseTest(
      'should mint tokens to public balance via embedded wallet',
      async ({ page }) => {
        await runMintToPublicTest(
          page,
          connectViaEmbeddedWallet,
          'Mint to Public via Embedded Wallet'
        );
      }
    );
  }
);
