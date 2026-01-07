import { defineWalletSetup } from '@synthetixio/synpress-cache';
import { MetaMask } from '@synthetixio/synpress/playwright';

// Test account (Anvil/Hardhat account #0)
const TEST_SEED = 'test test test test test test test test test test test junk';
const TEST_PASSWORD = 'TestPassword123!';

export default defineWalletSetup(TEST_PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, TEST_PASSWORD);
  await metamask.importWallet(TEST_SEED);
});
