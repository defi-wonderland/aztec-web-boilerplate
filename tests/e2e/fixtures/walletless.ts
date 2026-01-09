/**
 * Playwright Fixture for @wonderland/walletless
 *
 * Provides a clean API for E2E testing with walletless provider.
 * Handles all the bridging between Node.js (where walletless runs)
 * and the browser (where the app runs).
 *
 * @example
 * ```ts
 * import { test, expect } from './fixtures/walletless';
 *
 * test('connect wallet', async ({ page, walletless }) => {
 *   await page.goto('/');
 *   // walletless is already injected as window.ethereum
 *   // Just interact with your app normally
 * });
 * ```
 */

import { test as base, type Page } from '@playwright/test';
import {
  createE2EProvider,
  ANVIL_ACCOUNTS,
  setSigningAccount,
  type E2EProvider,
} from '@wonderland/walletless';
import { defineChain } from 'viem';

// Default Anvil chain configuration
const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

export interface WalletlessFixture {
  /** The walletless E2E provider instance */
  provider: E2EProvider;
  /** Current test account */
  account: (typeof ANVIL_ACCOUNTS)[0];
  /** All available Anvil accounts */
  accounts: typeof ANVIL_ACCOUNTS;
  /** Switch to a different Anvil account (0-9) */
  switchAccount: (index: number) => void;
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

/**
 * Injects the walletless provider into the page.
 * This bridges the Node.js provider to the browser via exposeFunction.
 */
async function injectWalletless(
  page: Page,
  provider: E2EProvider,
  account: (typeof ANVIL_ACCOUNTS)[0],
  chainId: number,
  debug: boolean
): Promise<void> {
  // Expose signing functions to the browser
  await page.exposeFunction('__walletless_sign__', async (message: string) => {
    return provider.request({
      method: 'personal_sign',
      params: [message, account.address],
    });
  });

  await page.exposeFunction(
    '__walletless_signTypedData__',
    async (typedDataJson: string) => {
      return provider.request({
        method: 'eth_signTypedData_v4',
        params: [account.address, typedDataJson],
      });
    }
  );

  await page.exposeFunction(
    '__walletless_eth_call__',
    async (txJson: string, blockTag: string) => {
      const tx = JSON.parse(txJson);
      return provider.request({
        method: 'eth_call',
        params: [tx, blockTag],
      });
    }
  );

  // Inject the browser-side provider
  await page.addInitScript(
    ({ address, chainId, debug }) => {
      const chainIdHex = `0x${chainId.toString(16)}`;
      const provider = {
        isMetaMask: true,
        isWalletless: true,
        chainId: chainIdHex,
        selectedAddress: address,

        request: async ({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) => {
          // if (debug) console.log('[walletless]', method, params);

          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return [address];

            case 'eth_chainId':
              return chainIdHex;

            case 'personal_sign':
            case 'eth_sign':
              return (window as any).__walletless_sign__(params?.[0]);

            case 'eth_signTypedData':
            case 'eth_signTypedData_v3':
            case 'eth_signTypedData_v4': {
              const data =
                typeof params?.[1] === 'string'
                  ? params[1]
                  : JSON.stringify(params?.[1]);
              return (window as any).__walletless_signTypedData__(data);
            }

            case 'wallet_switchEthereumChain':
            case 'wallet_addEthereumChain':
              return null;

            case 'eth_call': {
              const tx = params?.[0];
              const blockTag = (params?.[1] as string) || 'latest';
              return (window as any).__walletless_eth_call__(
                JSON.stringify(tx),
                blockTag
              );
            }

            default:
              if (debug) console.warn('[walletless] Unhandled:', method);
              throw new Error(`Method not supported: ${method}`);
          }
        },

        on: () => {},
        removeListener: () => {},
      };

      (window as any).ethereum = provider;
      if (debug) console.log('[walletless] Injected:', address);
    },
    { address: account.address, chainId, debug }
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

    // Create the walletless provider
    const provider = createE2EProvider({
      chains: [anvil],
      rpcUrls: { 31337: rpcUrl },
      account: ANVIL_ACCOUNTS[accountIndex].privateKey,
      debug,
    });

    let currentAccount = ANVIL_ACCOUNTS[accountIndex];

    // Inject provider into page
    await injectWalletless(page, provider, currentAccount, chainId, debug);

    // Set up console logging if debug enabled
    if (debug) {
      page.on('console', (msg) => {
        if (msg.text().includes('[walletless]')) {
          console.log(`[browser] ${msg.text()}`);
        }
      });
    }

    // Provide the fixture to tests
    await use({
      provider,
      account: currentAccount,
      accounts: ANVIL_ACCOUNTS,
      switchAccount: (index: number) => {
        if (index < 0 || index > 9) {
          throw new Error('Account index must be 0-9');
        }
        currentAccount = ANVIL_ACCOUNTS[index];
        setSigningAccount(provider, index);
      },
    });
  },
});

export { expect } from '@playwright/test';
export { ANVIL_ACCOUNTS };
