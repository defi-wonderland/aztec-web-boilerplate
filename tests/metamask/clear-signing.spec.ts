/**
 * MetaMask E2E tests for EIP-712 Clear Signing
 *
 * Single end-to-end test that covers the full flow:
 * 1. Connect MetaMask and derive public key
 * 2. Connect to PXE sandbox
 * 3. Deploy EIP-712 account contract
 * 4. Sign transaction with clear signing
 *
 * Prerequisites:
 * 1. Aztec sandbox running at localhost:8080
 * 2. Web server running (Playwright starts it automatically)
 *
 * Run with: yarn test:metamask
 */

import { test, expect } from './fixtures';
import { createConsoleCapture } from './helpers/console';

test.describe('EIP-712 Clear Signing E2E', () => {
  test('full flow: connect, deploy, and sign', async ({ page, metamask }) => {
    const capture = createConsoleCapture(page);

    // Capture all console errors for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[BROWSER ERROR]', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('[PAGE ERROR]', error.message);
      console.log('[STACK]', error.stack);
    });

    // Step 1: Load the app
    console.log('\n=== Step 1: Load app ===');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="connect-metamask"]', { timeout: 30000 });
    console.log('✓ App loaded');

    // Step 2: Connect MetaMask
    console.log('\n=== Step 2: Connect MetaMask ===');
    await page.click('[data-testid="connect-metamask"]');
    await metamask.connectToDapp();
    console.log('✓ MetaMask connected to dapp');

    // Step 3: Derive public key (sign message)
    console.log('\n=== Step 3: Derive public key ===');
    await metamask.confirmSignature();
    await expect(page.locator('[data-testid="metamask-connected"]')).toBeAttached({ timeout: 10000 });
    await expect(page.locator('[data-testid="public-key-derived"]')).toBeAttached({ timeout: 10000 });
    console.log('✓ Public key derived');

    // Step 4: Connect to PXE sandbox
    console.log('\n=== Step 4: Connect to PXE ===');
    await expect(page.locator('[data-testid="step-indicator"]')).toHaveAttribute('data-step', 'connect-pxe', { timeout: 10000 });
    await page.click('[data-testid="connect-pxe"]');
    await expect(page.locator('[data-testid="pxe-connected"]')).toBeAttached({ timeout: 120000 });
    console.log('✓ PXE connected');

    // Step 5: Deploy EIP-712 account contract
    console.log('\n=== Step 5: Deploy account ===');
    await expect(page.locator('[data-testid="step-indicator"]')).toHaveAttribute('data-step', 'deploy-account', { timeout: 5000 });
    await page.click('[data-testid="deploy-account"]');

    // May need to approve signature for deployment (or may be sponsored)
    try {
      console.log('Checking for signature request...');
      await metamask.confirmSignature();
      console.log('✓ Signature confirmed');
    } catch {
      console.log('No signature required (sponsored deployment)');
    }

    // Wait for deployment - this can take several minutes
    console.log('Waiting for deployment (up to 5 minutes)...');
    await expect(page.locator('[data-testid="account-deployed"]')).toBeAttached({ timeout: 300000 });
    console.log('✓ Account deployed');

    // Step 6: Sign transaction with clear signing
    console.log('\n=== Step 6: Sign transaction ===');
    await expect(page.locator('[data-testid="step-indicator"]')).toHaveAttribute('data-step', 'ready', { timeout: 5000 });
    await page.click('[data-testid="sign-tx"]');

    // Approve EIP-712 signature request
    console.log('Approving EIP-712 signature...');
    await metamask.confirmSignature();

    // Verify signature was captured
    await expect(page.locator('[data-testid="tx-signed"]')).toBeAttached({ timeout: 30000 });
    console.log('✓ Transaction signed with clear signing');

    // Dump console logs
    console.log('\n=== Console Logs ===');
    capture.dump();
    console.log('\n=== E2E Test Complete ===');
  }, 600000); // 10 minute timeout for full flow
});
