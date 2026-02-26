/**
 * App-Managed Adapter
 *
 * Builds a UseAztecConfig for users with a custom app-managed PXE wallet.
 */

import { executeAppManagedBatch } from '../../core/executeBatchRead';
import { executeAppManagedRead } from '../../core/executeRead';
import { executeAppManagedWrite } from '../../core/executeWrite';
import { DEFAULT_LOGGER } from '../types';
import type {
  UseAztecConfig,
  UseAztecAppManagedConfig,
  ReadExecutionParams,
  BatchReadExecutionParams,
  WriteExecutionParams,
  BatchReadResult,
  WriteContractData,
} from '../types';

const DEFAULT_FEE_PAYMENT_METHOD = 'sponsored' as const;

/**
 * Builds a UseAztecConfig from custom app-managed PXE inputs.
 */
export const buildAppManagedConfig = (
  input: UseAztecAppManagedConfig
): UseAztecConfig => {
  const {
    getWallet,
    account,
    isConnected,
    createFeePaymentMethod,
    defaultFeePaymentMethod = DEFAULT_FEE_PAYMENT_METHOD,
    logger: inputLogger,
  } = input;

  const logger = inputLogger ?? DEFAULT_LOGGER;

  const executeRead = async (params: ReadExecutionParams): Promise<unknown> => {
    if (!account) throw new Error('Account not available');
    const wallet = getWallet();
    if (!wallet) throw new Error('Wallet instance not available');

    return executeAppManagedRead({
      wallet,
      fromAddress: account.getAddress(),
      artifact: params.artifact,
      address: params.address,
      functionName: params.functionName,
      args: params.args,
    });
  };

  const executeBatchRead = async (
    params: BatchReadExecutionParams
  ): Promise<BatchReadResult[] | unknown[]> => {
    if (!account) throw new Error('Account not available');
    const wallet = getWallet();
    if (!wallet) throw new Error('Wallet instance not available');

    return executeAppManagedBatch({
      wallet,
      fromAddress: account.getAddress(),
      contracts: params.contracts,
      allowFailure: params.allowFailure,
    });
  };

  const executeWrite = async (
    params: WriteExecutionParams
  ): Promise<WriteContractData> => {
    if (!account) throw new Error('Account not available');
    const wallet = getWallet();
    if (!wallet) throw new Error('Wallet instance not available');

    return executeAppManagedWrite({
      wallet,
      fromAddress: account.getAddress(),
      artifact: params.artifact,
      address: params.address,
      functionName: params.functionName,
      args: params.args,
      createFeePaymentMethod,
      feePaymentMethod: params.feePaymentMethod ?? defaultFeePaymentMethod,
      timeout: params.timeout ?? 900,
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
