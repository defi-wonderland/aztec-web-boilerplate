/**
 * Connector Adapter
 *
 * Builds a UseAztecConfig from an aztec-wallet WalletConnector.
 * This is the ONLY file in use-aztec that imports from aztec-wallet type guards.
 */

import { createFeePaymentMethod } from '../../../services/aztec/feePayment';
import {
  isBrowserWalletConnector,
  hasAppManagedPXE,
} from '../../../types/walletConnector';
import {
  executeBrowserWalletBatch,
  executeAppManagedBatch,
} from '../../core/executeBatchRead';
import {
  executeAppManagedRead,
  executeBrowserWalletRead,
} from '../../core/executeRead';
import {
  executeBrowserWalletWrite,
  executeAppManagedWrite,
} from '../../core/executeWrite';
import { DEFAULT_LOGGER } from '../types';
import type { FeePaymentContext } from '../../../services/aztec/feePayment';
import type {
  UseAztecConfig,
  UseAztecConnectorConfig,
  ReadExecutionParams,
  BatchReadExecutionParams,
  WriteExecutionParams,
  BatchReadResult,
  WriteContractData,
} from '../types';

const DEFAULT_FEE_PAYMENT_METHOD = 'sponsored' as const;

/**
 * Builds a UseAztecConfig from an aztec-wallet connector.
 */
export const buildConnectorConfig = (
  input: UseAztecConnectorConfig
): UseAztecConfig => {
  const {
    connector,
    account,
    isConnected,
    feePaymentConfig,
    defaultFeePaymentMethod = DEFAULT_FEE_PAYMENT_METHOD,
    logger: inputLogger,
  } = input;

  const logger = inputLogger ?? DEFAULT_LOGGER;

  const executeRead = async (params: ReadExecutionParams): Promise<unknown> => {
    if (!connector || !account) {
      throw new Error('Wallet not connected');
    }

    if (isBrowserWalletConnector(connector)) {
      return executeBrowserWalletRead({
        executeOperation: (op) => connector.executeOperation(op),
        getCaipAccount: () => connector.getCaipAccount(),
        address: params.address,
        functionName: params.functionName,
        args: params.args,
      });
    }

    if (hasAppManagedPXE(connector)) {
      const wallet = connector.getWallet();
      if (!wallet) {
        throw new Error('Wallet instance not available');
      }

      return executeAppManagedRead({
        wallet,
        fromAddress: account.getAddress(),
        artifact: params.artifact,
        address: params.address,
        functionName: params.functionName,
        args: params.args,
      });
    }

    throw new Error('Unknown wallet type');
  };

  const executeBatchRead = async (
    params: BatchReadExecutionParams
  ): Promise<BatchReadResult[] | unknown[]> => {
    if (!connector || !account) {
      throw new Error('Wallet not connected');
    }

    if (isBrowserWalletConnector(connector)) {
      return executeBrowserWalletBatch({
        executeOperation: (op) => connector.executeOperation(op),
        getCaipAccount: () => connector.getCaipAccount(),
        contracts: params.contracts,
        allowFailure: params.allowFailure,
      });
    }

    if (hasAppManagedPXE(connector)) {
      const wallet = connector.getWallet();
      if (!wallet) {
        throw new Error('Wallet instance not available');
      }

      return executeAppManagedBatch({
        wallet,
        fromAddress: account.getAddress(),
        contracts: params.contracts,
        allowFailure: params.allowFailure,
      });
    }

    throw new Error('Unknown wallet type');
  };

  const executeWrite = async (
    params: WriteExecutionParams
  ): Promise<WriteContractData> => {
    if (!connector || !account) {
      throw new Error('Wallet not connected');
    }

    if (isBrowserWalletConnector(connector)) {
      return executeBrowserWalletWrite({
        sendTransaction: (req) => connector.sendTransaction(req),
        executeOperation: (op) => connector.executeOperation(op),
        getCaipAccount: () => connector.getCaipAccount(),
        artifact: params.artifact,
        address: params.address,
        functionName: params.functionName,
        args: params.args,
        receiptPolling: params.receiptPolling,
        logger,
      });
    }

    if (hasAppManagedPXE(connector)) {
      const wallet = connector.getWallet();
      if (!wallet) {
        throw new Error('Wallet instance not available');
      }

      const feePaymentContext: FeePaymentContext = {
        config: feePaymentConfig ?? {},
        getSponsoredFeePaymentMethod: () =>
          connector.getSponsoredFeePaymentMethod(),
      };

      return executeAppManagedWrite({
        wallet,
        fromAddress: account.getAddress(),
        artifact: params.artifact,
        address: params.address,
        functionName: params.functionName,
        args: params.args,
        createFeePaymentMethod: (type) =>
          createFeePaymentMethod(type, feePaymentContext),
        feePaymentMethod: params.feePaymentMethod ?? defaultFeePaymentMethod,
        timeout: params.timeout ?? 900,
        logger,
      });
    }

    throw new Error('Unknown wallet type');
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
