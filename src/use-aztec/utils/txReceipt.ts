import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
  GetTxReceiptOp,
} from '../types/browserWallet';

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 30; // 60 seconds total

export interface WaitForReceiptParams {
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
  txHash: string;
  chain: string;
  intervalMs?: number;
  maxAttempts?: number;
}

export type WaitForReceiptResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Polls for a transaction receipt until confirmed or timeout.
 * Parameterized — accepts an executeOperation function instead of a connector.
 */
export const waitForReceipt = async (
  params: WaitForReceiptParams
): Promise<WaitForReceiptResult> => {
  const {
    executeOperation,
    txHash,
    chain,
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const operation: GetTxReceiptOp = {
        kind: 'aztec_getTxReceipt',
        chain,
        txHash,
      };
      const result = await executeOperation(operation);

      if (result.status === 'failed') {
        const errorMsg =
          'error' in result && result.error
            ? String(result.error)
            : 'Failed to get receipt';
        return { success: false, error: errorMsg };
      }

      if (result.status === 'ok' && result.result) {
        const receipt = result.result as { status?: string };
        const txStatus = receipt.status?.toLowerCase();

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
      console.debug(
        `[txReceipt] Attempt ${attempt}/${maxAttempts} error:`,
        err
      );
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return { success: false, error: 'Transaction confirmation timeout' };
};
