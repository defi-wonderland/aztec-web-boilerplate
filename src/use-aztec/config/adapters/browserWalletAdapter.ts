/**
 * Browser Wallet Adapter
 *
 * Builds a UseAztecConfig for users with a custom browser wallet implementation.
 */

import { executeBrowserWalletBatch } from '../../core/executeBatchRead';
import { executeBrowserWalletRead } from '../../core/executeRead';
import { executeBrowserWalletWrite } from '../../core/executeWrite';
import { DEFAULT_LOGGER } from '../types';
import type {
  UseAztecConfig,
  UseAztecBrowserWalletConfig,
  ReadExecutionParams,
  BatchReadExecutionParams,
  WriteExecutionParams,
  BatchReadResult,
  WriteContractData,
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

  const logger = inputLogger ?? DEFAULT_LOGGER;

  const executeRead = async (params: ReadExecutionParams): Promise<unknown> => {
    return executeBrowserWalletRead({
      executeOperation,
      getCaipAccount,
      address: params.address,
      functionName: params.functionName,
      args: params.args,
    });
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
