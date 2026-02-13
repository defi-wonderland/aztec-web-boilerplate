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
 * Helper to dump the current page state for debugging
 */
async function logPageState(page: Page, tag: string): Promise<void> {
  const checks = {
    'dripper-form': '[data-testid="dripper-form"]',
    'token-balance-card': '[data-testid="token-balance-card"]',
    'connect-wallet-button': '[data-testid="connect-wallet-button"]:visible',
    'connected-account': '[data-testid="connected-account"]:visible',
    'contract-error': 'text=Contract Registration Failed',
    'loading-contracts': 'text=Loading contracts',
  };

  const results: Record<string, boolean> = {};
  for (const [name, selector] of Object.entries(checks)) {
    results[name] = await page
      .locator(selector)
      .first()
      .isVisible()
      .catch(() => false);
  }
  console.log(`[${tag}] Element visibility:`, JSON.stringify(results));

  // Capture loading text if present
  const loadingText = await page
    .locator('text=Loading contracts')
    .first()
    .textContent()
    .catch(() => null);
  if (loadingText) {
    console.log(`[${tag}] Loading text: "${loadingText}"`);
  }

  const spinnerCount = await page.locator('.animate-spin').count();
  if (spinnerCount > 0) {
    console.log(`[${tag}] Active spinners: ${spinnerCount}`);
  }
}

/**
 * Helper to get current public balance from the UI
 */
async function getPublicBalance(page: Page): Promise<bigint> {
  const balanceCard = page.locator('[data-testid="token-balance-card"]');

  // Diagnostic: log page state if balance card isn't immediately found
  const isVisible = await balanceCard.isVisible().catch(() => false);
  if (!isVisible) {
    console.log(
      '[getPublicBalance] token-balance-card NOT visible yet, diagnosing...'
    );
    console.log('[getPublicBalance] Current URL:', page.url());

    await logPageState(page, 'getPublicBalance');

    // Poll every 5s to track state changes while waiting
    const pollInterval = setInterval(async () => {
      await logPageState(page, 'getPublicBalance:poll').catch(() => { });
    }, 5000);

    // Log the body's visible text (truncated) for context
    const bodyText = await page
      .locator('body')
      .innerText()
      .catch(() => '<failed to read>');
    console.log(
      '[getPublicBalance] Page body text (first 500 chars):',
      bodyText.slice(0, 500)
    );

    try {
      await expect(balanceCard).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
    } finally {
      clearInterval(pollInterval);
    }
  } else {
    console.log('[getPublicBalance] token-balance-card already visible');
  }

  // If we got here without the early return above, the card is now visible
  await expect(balanceCard).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
  console.log('[getPublicBalance] balance card confirmed visible');

  const loadingSpinner = page.locator('[data-testid="balance-loading"]');
  const spinnerVisible = await loadingSpinner.isVisible().catch(() => false);
  console.log('[getPublicBalance] balance-loading spinner visible:', spinnerVisible);
  if (spinnerVisible) {
    console.log('[getPublicBalance] Waiting for balance to finish loading...');
    await expect(loadingSpinner).not.toBeVisible({ timeout: TIMEOUTS.LONG });
    console.log('[getPublicBalance] Balance loading complete');
  }

  const balanceValue = page.locator('[data-testid="balance-value-public"]');
  console.log('[getPublicBalance] Waiting for balance-value-public...');
  await expect(balanceValue).toBeVisible({ timeout: 10000 });

  const balanceText = await balanceValue.textContent();
  console.log('[getPublicBalance] Raw balance text:', JSON.stringify(balanceText));
  return BigInt(balanceText?.trim() || '0');
}

/**
 * Helper to wait for balance to sync after minting
 */
async function waitForBalanceSync(
  page: Page,
  expectedMinimum: bigint,
  timeout = TIMEOUTS.LONG
): Promise<bigint> {
  console.log(`[waitForBalanceSync] Waiting for balance >= ${expectedMinimum} (timeout: ${timeout}ms)`);
  const startTime = Date.now();
  let iteration = 0;

  while (Date.now() - startTime < timeout) {
    iteration++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[waitForBalanceSync] Iteration ${iteration} (${elapsed}s elapsed)`);

    const balance = await getPublicBalance(page);
    console.log(`[waitForBalanceSync] Current balance: ${balance}`);
    if (balance >= expectedMinimum) {
      return balance;
    }
    await page.waitForTimeout(2000);

    const refetchBadge = page.locator('[data-testid="balance-syncing"]');
    if (await refetchBadge.isVisible()) {
      console.log('[waitForBalanceSync] Balance syncing badge visible, waiting...');
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
  console.log('[mintToPublic] Starting...');
  const dripperContent = page.locator('[data-testid="dripper-form"]');
  await expect(dripperContent).toBeVisible({ timeout: TIMEOUTS.LONG });
  console.log('[mintToPublic] dripper-form visible');

  const loadingSpinner = dripperContent.locator('.animate-spin');
  if (await loadingSpinner.isVisible()) {
    console.log('[mintToPublic] Waiting for form spinner to clear...');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.WALLET_OPERATION,
    });
  }

  const amountInput = page.locator('#amount');
  await expect(amountInput).toBeVisible({ timeout: 10000 });
  await expect(amountInput).toBeEnabled({ timeout: 10000 });
  await amountInput.fill(amount);
  console.log('[mintToPublic] Amount filled:', amount);

  const dripTypeTrigger = page.locator('#drip-type');
  await expect(dripTypeTrigger).toBeEnabled({ timeout: 10000 });
  await dripTypeTrigger.click();
  const publicOption = page
    .locator('[role="option"]')
    .filter({ hasText: 'Public' });
  await publicOption.click();
  console.log('[mintToPublic] Drip type set to Public');

  const dripButton = page.locator('[data-testid="drip-button"]');
  await expect(dripButton).toBeVisible({ timeout: 10000 });
  const buttonText = await dripButton.textContent();
  console.log('[mintToPublic] Drip button text:', JSON.stringify(buttonText));

  const isEnabled = await dripButton.isEnabled();
  console.log('[mintToPublic] Drip button enabled:', isEnabled);
  if (!isEnabled) {
    console.log('[mintToPublic] Waiting for drip button to become enabled...');
  }
  await expect(dripButton).toBeEnabled({ timeout: TIMEOUTS.DEFAULT });
  console.log('[mintToPublic] Drip button enabled, clicking...');

  await dripButton.click();
  console.log('[mintToPublic] Drip button clicked');

  await page.waitForTimeout(100);

  try {
    await expect(dripButton).toContainText('Processing', { timeout: 2000 });
    console.log('[mintToPublic] Transaction processing...');
  } catch {
    const currentText = await dripButton.textContent().catch(() => 'unknown');
    console.log(
      '[mintToPublic] Processing state not caught, button text:',
      JSON.stringify(currentText)
    );
  }

  console.log('[mintToPublic] Waiting for transaction to complete (up to 60s)...');
  await expect(dripButton).toContainText('Drip to', { timeout: TIMEOUTS.LONG });
  console.log('[mintToPublic] Transaction completed');
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

  // Capture browser console logs for contract registry debugging
  const browserLogs: string[] = [];
  const consoleHandler = (msg: import('@playwright/test').ConsoleMessage) => {
    const text = msg.text();
    // Capture registry, contract, and error logs
    if (
      msg.type() === 'error' ||
      text.includes('Contract') ||
      text.includes('contract') ||
      text.includes('Registry') ||
      text.includes('registry') ||
      text.includes('PXE') ||
      text.includes('📦') ||
      text.includes('🆕') ||
      text.includes('💾') ||
      text.includes('❌') ||
      text.includes('⏳')
    ) {
      const logLine = `[browser:${msg.type()}] ${text}`;
      browserLogs.push(logLine);
      console.log(logLine);
    }
  };
  page.on('console', consoleHandler);

  try {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await connectFn(page);

    console.log(
      `[${testName}] Post-connect browser logs (${browserLogs.length}):`
    );
    browserLogs.forEach((log) => console.log(`  ${log}`));

    await logPageState(page, `${testName}:post-connect`);

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
  } finally {
    page.off('console', consoleHandler);
  }
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
