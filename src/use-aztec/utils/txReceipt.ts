import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
  GetTxReceiptOp,
} from '../../types/browserWallet';
import type { UseAztecLogger } from '../config/types';

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
 * Polls for a transaction receipt until confirmed or timeout.
 * Parameterized — accepts an executeOperation function instead of a connector.
 */
export const waitForReceipt = async (
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>,
  txHash: string,
  chain: string,
  logger: UseAztecLogger,
  options: WaitForReceiptOptions = {}
): Promise<WaitForReceiptResult> => {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  logger.info(`Polling for txHash: ${txHash} on chain: ${chain}`);

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
          'error' in result ? String(result.error) : 'Failed to get receipt';
        logger.info(
          `Attempt ${attempt}/${maxAttempts} - Operation failed:`,
          result
        );
        return { success: false, error: errorMsg };
      }

      if (result.status === 'ok' && result.result) {
        const receipt = result.result as { status?: string };
        const txStatus = receipt.status?.toLowerCase();
        logger.info(
          `Attempt ${attempt}/${maxAttempts} - Receipt status: ${txStatus}`
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
      logger.info(`Attempt ${attempt}/${maxAttempts} - Error:`, err);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return { success: false, error: 'Transaction confirmation timeout' };
};
