/**
 * E2E Test: Mint to Public Balance
 *
 * Tests the minting functionality for both:
 * 1. Walletless (MetaMask simulation via @wonderland/walletless)
 * 2. Embedded wallet (Create New Account)
 *
 * Completion criteria: Public balance increases after minting
 */

import { test, expect, ANVIL_ACCOUNTS } from './fixtures/walletless';
import { test as baseTest } from '@playwright/test';

const MINT_AMOUNT = '1';
const WALLET_OPERATION_TIMEOUT = 120000;

/**
 * Helper to clear browser storage before each test
 */
async function clearBrowserStorage(page: import('@playwright/test').Page) {
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
 * Helper to switch to Sandbox network
 */
async function switchToSandbox(page: import('@playwright/test').Page) {
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
}

/**
 * Helper to open the connect modal
 * Returns the modal locator
 */
async function openConnectModal(page: import('@playwright/test').Page) {
  // Click "Connect Wallet" to open modal
  const connectBtn = page.locator('[data-testid="connect-wallet-button"]');
  await expect(connectBtn).toBeVisible({ timeout: 30000 });
  await connectBtn.click();

  // Wait for modal
  const modal = page.locator('[data-testid="connect-wallet-modal"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  return modal;
}

/**
 * Helper to connect via EVM wallet (MetaMask)
 */
async function connectViaEVMWallet(page: import('@playwright/test').Page) {
  // First switch to Sandbox
  await switchToSandbox(page);

  const modal = await openConnectModal(page);

  // Click "EVM Wallet" group to see EVM wallets list
  const evmWalletGroup = modal.locator('[data-testid="wallet-group-evm"]');
  await expect(evmWalletGroup).toBeVisible({ timeout: 5000 });
  await evmWalletGroup.click();

  // Click MetaMask button
  const metamaskBtn = modal.locator('[data-testid="wallet-button-metamask"]');
  await expect(metamaskBtn).toBeVisible({ timeout: 10000 });
  await metamaskBtn.click();
  console.log('MetaMask button clicked, waiting for wallet connection...');

  // Wait for modal to close (connection complete)
  await expect(modal).not.toBeVisible({ timeout: WALLET_OPERATION_TIMEOUT });
  console.log('Wallet connected');

  // Wait for account section to be visible
  const accountSection = page.locator('[data-testid="connected-account"]');
  await expect(accountSection).toBeVisible({
    timeout: WALLET_OPERATION_TIMEOUT,
  });
}

/**
 * Helper to connect via Embedded wallet
 */
async function connectViaEmbeddedWallet(page: import('@playwright/test').Page) {
  // First switch to Sandbox
  await switchToSandbox(page);

  const modal = await openConnectModal(page);

  // Click "Embedded Wallet" group
  const embeddedGroup = modal.locator('[data-testid="wallet-group-embedded"]');
  await expect(embeddedGroup).toBeVisible({ timeout: 5000 });
  await embeddedGroup.click();
  console.log('Embedded Wallet clicked, waiting for account creation...');

  // Wait for modal to close (account creation complete)
  await expect(modal).not.toBeVisible({ timeout: WALLET_OPERATION_TIMEOUT });
  console.log('Account created and connected');

  // Wait for account section to be visible
  const accountSection = page.locator('[data-testid="connected-account"]');
  await expect(accountSection).toBeVisible({
    timeout: WALLET_OPERATION_TIMEOUT,
  });
}

/**
 * Helper to get current public balance from the UI
 */
async function getPublicBalance(
  page: import('@playwright/test').Page
): Promise<bigint> {
  // Wait for balance card to be visible
  const balanceCard = page.locator('[data-testid="token-balance-card"]');
  await expect(balanceCard).toBeVisible({ timeout: 30000 });

  // Wait for loading to complete
  const loadingSpinner = page.locator('[data-testid="balance-loading"]');
  if (await loadingSpinner.isVisible()) {
    await expect(loadingSpinner).not.toBeVisible({ timeout: 60000 });
  }

  // Get the public balance value
  const balanceValue = page.locator('[data-testid="balance-value-public"]');
  await expect(balanceValue).toBeVisible({ timeout: 10000 });

  const balanceText = await balanceValue.textContent();
  return BigInt(balanceText?.trim() || '0');
}

/**
 * Helper to wait for balance to sync after minting
 */
async function waitForBalanceSync(
  page: import('@playwright/test').Page,
  expectedMinimum: bigint,
  timeout = 60000
): Promise<bigint> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const balance = await getPublicBalance(page);
    if (balance >= expectedMinimum) {
      return balance;
    }
    // Wait a bit before checking again
    await page.waitForTimeout(2000);

    // Check if there's a refetch happening
    const refetchBadge = page.locator('[data-testid="balance-syncing"]');
    if (await refetchBadge.isVisible()) {
      await expect(refetchBadge).not.toBeVisible({ timeout: 30000 });
    }
  }

  throw new Error(
    `Balance did not reach expected minimum ${expectedMinimum} within ${timeout}ms`
  );
}

/**
 * Helper to mint tokens to public balance
 */
async function mintToPublic(
  page: import('@playwright/test').Page,
  amount: string
) {
  // Wait for dripper form to be visible
  const dripperContent = page.locator('[data-testid="dripper-form"]');
  await expect(dripperContent).toBeVisible({ timeout: 60000 });

  // Wait for contracts to load (loading spinner should disappear)
  const loadingSpinner = dripperContent.locator('.animate-spin');
  if (await loadingSpinner.isVisible()) {
    await expect(loadingSpinner).not.toBeVisible({ timeout: 120000 });
  }

  // Enter amount
  const amountInput = page.locator('#amount');
  await expect(amountInput).toBeVisible({ timeout: 10000 });
  await expect(amountInput).toBeEnabled({ timeout: 10000 });
  await amountInput.fill(amount);

  // Select public drip type using Radix Select
  const dripTypeTrigger = page.locator('#drip-type');
  await expect(dripTypeTrigger).toBeEnabled({ timeout: 10000 });
  await dripTypeTrigger.click();
  const publicOption = page.locator('[role="option"]').filter({ hasText: 'Public' });
  await publicOption.click();

  // Find the drip button
  const dripButton = page.locator('[data-testid="drip-button"]');
  await expect(dripButton).toBeVisible({ timeout: 10000 });
  await expect(dripButton).toBeEnabled({ timeout: 30000 });

  // Click the drip button
  await dripButton.click();
  console.log('Drip button clicked');

  // Small delay to let React update the button state
  await page.waitForTimeout(100);

  // Wait for button to show "Processing..." (transaction in progress)
  // Use a try-catch since it might be too fast to catch
  try {
    await expect(dripButton).toContainText('Processing', { timeout: 2000 });
    console.log('Transaction processing...');
  } catch {
    console.log('Processing state too fast to catch, checking if already done...');
  }

  // Wait for button to return to "Drip to" (transaction complete)
  await expect(dripButton).toContainText('Drip to', { timeout: 60000 });
  console.log('Transaction completed');
}

test.describe('Mint to Public - Walletless (MetaMask)', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserStorage(page);
  });

  test('should mint tokens to public balance via walletless MetaMask', async ({
    page,
    walletless,
  }) => {
    console.log('\n=== E2E: Mint to Public via Walletless ===\n');
    console.log('Test account:', walletless.account.address);

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Connect via EVM wallet (MetaMask)
    await connectViaEVMWallet(page);

    // Get initial public balance
    const initialBalance = await getPublicBalance(page);
    console.log('Initial public balance:', initialBalance.toString());

    // Mint tokens to public balance
    console.log(`Minting ${MINT_AMOUNT} tokens to public balance...`);
    await mintToPublic(page, MINT_AMOUNT);
    console.log('Mint transaction submitted');

    // Wait for balance to increase
    const expectedMinBalance = initialBalance + BigInt(MINT_AMOUNT);
    const finalBalance = await waitForBalanceSync(page, expectedMinBalance);
    console.log('Final public balance:', finalBalance.toString());

    // Assert balance increased
    expect(finalBalance).toBeGreaterThanOrEqual(expectedMinBalance);
    console.log(
      `Balance increased by ${(finalBalance - initialBalance).toString()} tokens`
    );

    console.log('\n=== TEST PASSED ===\n');
  });
});

// Use base test (without walletless fixture) for embedded wallet test
baseTest.describe('Mint to Public - Embedded Wallet (Create New Account)', () => {
  baseTest.beforeEach(async ({ page }) => {
    await clearBrowserStorage(page);
  });

  baseTest(
    'should mint tokens to public balance via embedded wallet',
    async ({ page }) => {
      console.log('\n=== E2E: Mint to Public via Embedded Wallet ===\n');

      // Navigate to app
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Connect via Embedded wallet
      await connectViaEmbeddedWallet(page);

      // Get initial public balance (should be 0 for new account)
      const initialBalance = await getPublicBalance(page);
      console.log('Initial public balance:', initialBalance.toString());

      // Mint tokens to public balance
      console.log(`Minting ${MINT_AMOUNT} tokens to public balance...`);
      await mintToPublic(page, MINT_AMOUNT);
      console.log('Mint transaction submitted');

      // Wait for balance to increase
      const expectedMinBalance = initialBalance + BigInt(MINT_AMOUNT);
      const finalBalance = await waitForBalanceSync(page, expectedMinBalance);
      console.log('Final public balance:', finalBalance.toString());

      // Assert balance increased
      expect(finalBalance).toBeGreaterThanOrEqual(expectedMinBalance);
      console.log(
        `Balance increased by ${(finalBalance - initialBalance).toString()} tokens`
      );

      console.log('\n=== TEST PASSED ===\n');
    }
  );
});
