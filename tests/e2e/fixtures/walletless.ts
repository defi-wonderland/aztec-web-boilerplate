/**
 * Playwright Fixture for @wonderland/walletless
 *
 * Bundles and injects walletless directly into the browser via addInitScript.
 *
 * @example
 * ```ts
 * import { test, expect } from './fixtures/walletless';
 *
 * test('connect wallet', async ({ page, walletless }) => {
 *   await page.goto('/');
 *   // walletless is already injected as window.ethereum
 * });
 * ```
 */

import { test as base, type Page } from '@playwright/test';
import { ANVIL_ACCOUNTS } from '@wonderland/walletless';

export interface WalletlessFixture {
  /** Current test account */
  account: (typeof ANVIL_ACCOUNTS)[0];
  /** All available Anvil accounts */
  accounts: typeof ANVIL_ACCOUNTS;
}

export interface WalletlessOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Initial account index (0-9), defaults to 0 */
  accountIndex?: number;
  /** Custom RPC URL, defaults to http://127.0.0.1:8545 */
  rpcUrl?: string;
  /** Chain ID, defaults to 31337 (Anvil) */
  chainId?: number;
}

// Cache the bundle to avoid rebuilding on every test
let bundleCache: string | null = null;

async function getWalletlessBundle(): Promise<string> {
  if (bundleCache) return bundleCache;

  const { build } = await import('esbuild');
  const result = await build({
    stdin: {
      contents: `export { createE2EProvider } from '@wonderland/walletless';`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    globalName: 'Walletless',
    platform: 'browser',
    target: 'es2020',
    write: false,
    minify: true,
  });

  const bundle = result.outputFiles?.[0]?.text ?? '';
  // IIFE creates `var Walletless = ...` which doesn't attach to window in addInitScript
  // Explicitly assign to window.Walletless
  bundleCache = bundle + '\nwindow.Walletless = Walletless;';
  return bundleCache;
}

/**
 * Injects the walletless provider into the page via addInitScript.
 */
async function injectWalletless(
  page: Page,
  options: {
    chainId: number;
    rpcUrl: string;
    privateKey: string;
    debug: boolean;
  }
): Promise<void> {
  const { chainId, rpcUrl, privateKey, debug } = options;

  // Inject the bundled walletless library
  const bundle = await getWalletlessBundle();
  await page.addInitScript(bundle);

  // Create and inject the provider
  await page.addInitScript(
    ({ chainId, rpcUrl, privateKey, debug }) => {
      try {
        const anvil = {
          id: chainId,
          name: 'Anvil',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [rpcUrl] } },
        };

        const provider = (window as any).Walletless.createE2EProvider({
          rpcUrls: { [chainId]: rpcUrl },
          chains: [anvil],
          account: privateKey,
          debug,
        });

        // Add compatibility flags
        (provider as any).isWalletless = true;
        (provider as any).isMetaMask = true;

        (window as any).ethereum = provider;
        if (debug) console.log('[walletless] Provider injected');
      } catch (e) {
        console.error('[walletless] Failed to inject provider:', e);
      }
    },
    { chainId, rpcUrl, privateKey, debug }
  );
}

/**
 * Extended Playwright test with walletless fixture.
 */
export const test = base.extend<{
  walletless: WalletlessFixture;
  walletlessOptions: WalletlessOptions;
}>({
  // Default options (can be overridden per-test)
  walletlessOptions: [{}, { option: true }],

  // The walletless fixture
  walletless: async ({ page, context, walletlessOptions }, use) => {
    const {
      debug = false,
      accountIndex = 0,
      rpcUrl = 'http://127.0.0.1:8545',
      chainId = 31337,
    } = walletlessOptions;

    // Clear storage before each test
    await context.clearCookies();

    // Inject the walletless provider into the browser
    const privateKey = ANVIL_ACCOUNTS[accountIndex].privateKey;
    await injectWalletless(page, { chainId, rpcUrl, privateKey, debug });

    // Set up console logging if debug enabled
    if (debug) {
      page.on('console', (msg) => {
        if (msg.text().includes('Walletless')) {
          console.log(`[browser] ${msg.text()}`);
        }
      });
    }

    // Provide the fixture to tests
    await use({
      account: ANVIL_ACCOUNTS[accountIndex],
      accounts: ANVIL_ACCOUNTS,
    });
  },
});

export { expect } from '@playwright/test';
export { ANVIL_ACCOUNTS };
