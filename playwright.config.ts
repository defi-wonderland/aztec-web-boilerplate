import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.PLAYWRIGHT_NUM_WORKERS
    ? Number(process.env.PLAYWRIGHT_NUM_WORKERS)
    : 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
  expect: {
    timeout: 20_000,
  },
  timeout: 400_000,
  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: ['**/tests/metamask/**'], // MetaMask only works in Chrome
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/tests/metamask/**'], // Regular tests without extension
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/tests/metamask/**'], // MetaMask only works in Chrome
    },
    {
      name: 'chromium-metamask',
      use: {
        ...devices['Desktop Chrome'],
        // MetaMask tests use their own browser context with extension
        // See tests/metamask/fixtures.ts for extension loading
      },
      testMatch: ['**/tests/metamask/**/*.spec.ts'],
    },
  ],

  webServer: {
    command: 'PORT=3000 yarn serve',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
