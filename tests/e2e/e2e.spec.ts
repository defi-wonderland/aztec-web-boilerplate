import { test, expect } from '@playwright/test';

test('app initialization and basic rendering', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Aztec Web Boilerplate/);
  
  // Wait for the app to be ready (wallet selector visible)
  const walletSelector = await page.locator('.wallet-selector');
  await expect(walletSelector).toBeVisible({ timeout: 30000 });
  
  // Check that basic components are rendering
  const header = await page.locator('.navbar');
  await expect(header).toBeVisible();
  
  const title = await page.locator('.nav-title');
  await expect(title).toBeVisible();
});

test('connect test account', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Aztec Web Boilerplate/);

  // Wait for the connect button to be visible (means app is ready)
  const connectTestAccount = await page.locator('#connect-test-account');
  await expect(connectTestAccount).toBeVisible({ timeout: 30000 });
  
  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();

  // Select different account for each browser
  const testAccountNumber = {
    'chromium': 1,
    'firefox': 2,
    'webkit': 3,
  }[testInfo.project.name];
  await selectTestAccount.selectOption(testAccountNumber.toString());

  await connectTestAccount.click();
  
  // Wait a moment for any errors to appear
  await page.waitForTimeout(2000);
  
  // Check if there are any error messages visible
  const statusMessage = await page.locator('#status-message');
  if (await statusMessage.isVisible()) {
    const errorText = await statusMessage.textContent();
  }
  
  // Wait for account to be connected and displayed
  // This can take time due to Aztec node communication
  const accountDisplay = await page.locator('#account-display');
  await expect(accountDisplay).toBeVisible({ timeout: 30000 });
  await expect(accountDisplay).toHaveText(/Account: 0x[a-fA-F0-9]{4}/);
});
