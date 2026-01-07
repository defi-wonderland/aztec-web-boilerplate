/**
 * MetaMask wallet setup for Synpress
 *
 * This file is automatically detected by Synpress CLI (npx synpress) to build
 * the wallet cache. The cache contains a pre-configured browser with MetaMask
 * extension already set up with the test account.
 *
 * File must be:
 * - Located in test/wallet-setup/
 * - Named with .setup.ts extension
 *
 * Run `npx synpress` to build the cache before running tests.
 */

import { defineWalletSetup } from '@synthetixio/synpress-cache';
import { MetaMask } from '@synthetixio/synpress/playwright';

// Test account (Anvil/Hardhat account #0)
export const TEST_SEED = 'test test test test test test test test test test test junk';
export const TEST_PASSWORD = 'TestPassword123!';

export default defineWalletSetup(TEST_PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, TEST_PASSWORD);
  await metamask.importWallet(TEST_SEED);
});
