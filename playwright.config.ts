import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.PLAYWRIGHT_NUM_WORKERS
    ? Number(process.env.PLAYWRIGHT_NUM_WORKERS)
    : 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: !!process.env.CI,
    launchOptions: {
      devtools: !process.env.CI,
    },
  },
  expect: {
    timeout: 20_000,
  },
  timeout: 400_000,
  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'PORT=3000 yarn serve',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
