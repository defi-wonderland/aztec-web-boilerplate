import { test, expect, Page, TestInfo } from '@playwright/test';

async function waitForAppReady(page: Page) {
  const connectButton = await page.locator('#connect-test-account');
  await expect(connectButton).toBeVisible({ timeout: 30000 });
}

async function connectTestAccount(page: Page, testInfo: TestInfo) {
  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();

  // Select different account for each browser to avoid conflicts
  const testAccountNumber = {
    'chromium': 1,
    'firefox': 2,
    'webkit': 3,
  }[testInfo.project.name];
  
  await selectTestAccount.selectOption(testAccountNumber.toString());
  
  const connectButton = await page.locator('#connect-test-account');
  await connectButton.click();
  
  await page.waitForTimeout(2000);
}

async function disconnectAccount(page: Page) {
  const disconnectButton = await page.locator('.disconnect-button');
  await disconnectButton.click();
  await expect(disconnectButton).not.toBeVisible();
}

async function waitForAccountConnected(page: Page) {
  const accountDisplay = await page.locator('#account-display');
  await expect(accountDisplay).toBeVisible({ timeout: 30000 });
  await expect(accountDisplay).toHaveText(/Account: 0x[a-fA-F0-9]{4}/);
}

test('app loads with correct title and basic structure', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Azt95/);
  
  const header = await page.locator('.navbar');
  await expect(header).toBeVisible();
  
  const title = await page.locator('.nav-title');
  await expect(title).toHaveText('Azt95.exe');
});

test('app shows connection options when not connected', async ({ page }) => {
  await page.goto('/');
  
  await waitForAppReady(page);
  
  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();
  
  const connectButton = await page.locator('#connect-test-account');
  await expect(connectButton).toBeVisible();
  
  const createAccountButton = await page.locator('button:has-text("Create Account")');
  await expect(createAccountButton).toBeVisible();
});

test('can connect test account successfully', async ({ page }, testInfo) => {
  await page.goto('/');
  
  await waitForAppReady(page);
  await connectTestAccount(page, testInfo);
  await waitForAccountConnected(page);
  await disconnectAccount(page);
  await waitForAppReady(page);
});

test('aztec interface appears after account connection', async ({ page }, testInfo) => {
  await page.goto('/');
  
  await waitForAppReady(page);
  await connectTestAccount(page, testInfo);
  await waitForAccountConnected(page);
  
  // Check that the Aztec interface is visible
  const aztecInterface = await page.locator('.aztec-eth95-interface');
  await expect(aztecInterface).toBeVisible({ timeout: 30000 });
  
  // Check that the input phase is shown (contract input form)
  const inputPhase = await page.locator('.input-phase');
  await expect(inputPhase).toBeVisible();
  
  // Check that the contract input container is present
  const inputContainer = await page.locator('.input-container');
  await expect(inputContainer).toBeVisible();
  
  // Check that the wallet notice is NOT shown (since wallet is connected)
  const walletNotice = await page.locator('.wallet-notice');
  await expect(walletNotice).not.toBeVisible();
  
  // Check that disconnect button is visible in header
  const disconnectButton = await page.locator('.disconnect-button');
  await expect(disconnectButton).toBeVisible();
});