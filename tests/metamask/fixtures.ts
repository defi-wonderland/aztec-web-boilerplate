/**
 * Playwright fixtures for MetaMask E2E tests using Synpress
 *
 * Synpress automatically handles MetaMask extension download, setup, and interactions.
 *
 * IMPORTANT: Before running tests, you must build the Synpress cache:
 *   npx synpress
 *
 * This downloads MetaMask and sets up the wallet with the test seed phrase.
 */

import { metaMaskFixtures, MetaMask } from '@synthetixio/synpress/playwright';

// Import wallet setup from the Synpress-expected location
import walletSetup from '../../test/wallet-setup/metamask.setup.js';

// Test account (Anvil/Hardhat account #0)
export const TEST_SEED = 'test test test test test test test test test test test junk';
export const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const TEST_PASSWORD = 'TestPassword123!';

/**
 * Create test with MetaMask fixtures from Synpress
 * The walletSetup is imported from test/wallet-setup/metamask.setup.ts
 * which is where Synpress CLI expects to find it for cache building.
 */
export const test = metaMaskFixtures(walletSetup, 0);

export { expect } from '@playwright/test';

// Re-export MetaMask class for type hints
export { MetaMask };

/**
 * Helper: Check if MetaMask is available (Synpress handles this automatically)
 */
export function isMetaMaskAvailable(): boolean {
  // Synpress handles MetaMask download automatically
  return true;
}

/**
 * Helper: Setup MetaMask with test account
 * Note: With Synpress, this is handled automatically by the walletSetup
 */
export async function setupMetaMask(
  context: unknown,
  extensionId: string,
  seedPhrase: string = TEST_SEED
): Promise<void> {
  // Synpress handles setup via walletSetup - this is a no-op for compatibility
  console.log('MetaMask setup handled by Synpress wallet cache');
}

/**
 * Helper: Wait for MetaMask popup
 */
export async function waitForMetaMaskPopup(
  context: { waitForEvent: (event: string, options?: { timeout: number }) => Promise<unknown> },
  timeout = 30000
): Promise<unknown> {
  return context.waitForEvent('page', { timeout });
}

/**
 * Helper: Approve connection via MetaMask instance
 */
export async function approveConnection(metamask: MetaMask): Promise<void> {
  await metamask.connectToDapp();
}

/**
 * Helper: Approve signature via MetaMask instance
 */
export async function approveSignature(metamask: MetaMask): Promise<void> {
  await metamask.confirmSignature();
}

/**
 * Helper: Reject request via MetaMask instance
 */
export async function rejectRequest(metamask: MetaMask): Promise<void> {
  await metamask.rejectSignature();
}
