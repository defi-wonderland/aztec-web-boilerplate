import type { GetTxReceiptOp } from '../types/browserWallet';
import type { BrowserWalletConnector } from '../types/walletConnector';

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 30; // 60 seconds total

export type WaitForReceiptOptions = {
  intervalMs?: number;
  maxAttempts?: number;
};

export type WaitForReceiptResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Polls a browser wallet for transaction receipt until confirmed or timeout.
 * Handles mined/success as success, dropped/failed/reverted as failures.
 */
export const waitForBrowserWalletReceipt = async (
  connector: BrowserWalletConnector,
  txHash: string,
  chain: string,
  options: WaitForReceiptOptions = {}
): Promise<WaitForReceiptResult> => {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  console.log(`[txReceipt] Polling for txHash: ${txHash} on chain: ${chain}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const operation: GetTxReceiptOp = {
        kind: 'aztec_getTxReceipt',
        chain,
        txHash,
      };
      const result = await connector.executeOperation(operation);

      if (result.status === 'failed') {
        const errorMsg =
          'error' in result ? String(result.error) : 'Failed to get receipt';
        console.log(
          `[txReceipt] Attempt ${attempt}/${maxAttempts} - Operation failed:`,
          result
        );
        return { success: false, error: errorMsg };
      }

      if (result.status === 'ok' && result.result) {
        const receipt = result.result as { status?: string };
        const txStatus = receipt.status?.toLowerCase();
        console.log(
          `[txReceipt] Attempt ${attempt}/${maxAttempts} - Receipt:`,
          receipt,
          'Status:',
          txStatus
        );

        if (txStatus === 'mined' || txStatus === 'success') {
          return { success: true };
        }

        if (
          txStatus === 'dropped' ||
          txStatus === 'failed' ||
          txStatus === 'reverted'
        ) {
          return { success: false, error: `Transaction ${txStatus}` };
        }
      }
    } catch (err) {
      // Network error - continue polling
      console.log(
        `[txReceipt] Attempt ${attempt}/${maxAttempts} - Error:`,
        err
      );
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return { success: false, error: 'Transaction confirmation timeout' };
};
