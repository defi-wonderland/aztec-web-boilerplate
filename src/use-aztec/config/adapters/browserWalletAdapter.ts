/**
 * Browser Wallet Adapter
 *
 * Builds a UseAztecConfig for users with a custom browser wallet implementation.
 */

import { executeBrowserWalletBatch } from '../../core/executeBatchRead';
import { executeBrowserWalletWrite } from '../../core/executeWrite';
import type { SimulateViewsOp } from '../../../types/browserWallet';
import type {
  UseAztecConfig,
  UseAztecBrowserWalletConfig,
  ReadExecutionParams,
  BatchReadExecutionParams,
  WriteExecutionParams,
  BatchReadResult,
  WriteContractData,
  UseAztecLogger,
} from '../types';

/**
 * Builds a UseAztecConfig from custom browser wallet inputs.
 */
export const buildBrowserWalletConfig = (
  input: UseAztecBrowserWalletConfig
): UseAztecConfig => {
  const {
    account,
    isConnected,
    executeOperation,
    sendTransaction,
    getCaipAccount,
    logger: inputLogger,
  } = input;

  const logger: UseAztecLogger = inputLogger ?? {
    info: (...args) => console.log('[use-aztec]', ...args),
    warn: (...args) => console.warn('[use-aztec]', ...args),
    error: (...args) => console.error('[use-aztec]', ...args),
    debug: (...args) => console.debug('[use-aztec]', ...args),
  };

  const executeRead = async (params: ReadExecutionParams): Promise<unknown> => {
    const selectedAccount = getCaipAccount();
    if (!selectedAccount) {
      throw new Error('Browser wallet account not selected');
    }

    const operation: SimulateViewsOp = {
      kind: 'simulate_views',
      account: selectedAccount,
      calls: [
        {
          kind: 'call',
          contract: params.address,
          method: params.functionName,
          args: params.args,
        },
      ],
    };

    const result = await executeOperation(operation);

    if (result.status !== 'ok') {
      const errorMsg =
        'error' in result && result.error ? result.error : 'Simulation failed';
      throw new Error(errorMsg);
    }

    return result.result;
  };

  const executeBatchRead = async (
    params: BatchReadExecutionParams
  ): Promise<BatchReadResult[] | unknown[]> => {
    return executeBrowserWalletBatch({
      executeOperation,
      getCaipAccount,
      contracts: params.contracts,
      allowFailure: params.allowFailure,
    });
  };

  const executeWrite = async (
    params: WriteExecutionParams
  ): Promise<WriteContractData> => {
    return executeBrowserWalletWrite({
      sendTransaction,
      executeOperation,
      getCaipAccount,
      artifact: params.artifact,
      address: params.address,
      functionName: params.functionName,
      args: params.args,
      receiptPolling: params.receiptPolling,
      logger,
    });
  };

  return {
    isConnected,
    account,
    executeRead,
    executeBatchRead,
    executeWrite,
    logger,
  };
};
