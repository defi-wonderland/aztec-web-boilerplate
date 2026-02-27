import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { createFeePaymentMethod } from '../../services/aztec/feePayment/index';
import {
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '../../types/walletConnector';
import {
  executeAppManagedBatch,
  executeAppManagedRead,
  executeAppManagedWrite,
  executeBrowserWalletBatch,
  executeBrowserWalletRead,
  executeBrowserWalletWrite,
} from '../../use-aztec/core';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';
import type { FeePaymentContractsConfig } from '../../config/networks/types';
import type { FeePaymentContext } from '../../services/aztec/feePayment/index';
import type { WalletConnector } from '../../types/walletConnector';
import type {
  AztecExecutionClient,
  BatchReadExecutionParams,
  ReadExecutionParams,
  WriteExecutionParams,
} from '../../use-aztec/types/execution';

export interface WalletWriteExecutionContext {
  feePaymentMethod?: FeePaymentMethodType;
}

interface CreateWalletExecutionClientParams {
  connector: WalletConnector | null;
  account: AccountWithSecretKey | null;
  isConnected: boolean;
  feePaymentConfig?: FeePaymentContractsConfig;
  defaultFeePaymentMethod: FeePaymentMethodType;
}

const resolveFeePaymentMethod = (
  feePaymentMethodInput: unknown,
  defaultFeePaymentMethod: FeePaymentMethodType
): FeePaymentMethodType => {
  if (typeof feePaymentMethodInput === 'string' && feePaymentMethodInput) {
    return feePaymentMethodInput as FeePaymentMethodType;
  }

  // Backward-compatible support for legacy `{ feePaymentMethod }` payloads.
  if (
    feePaymentMethodInput &&
    typeof feePaymentMethodInput === 'object' &&
    'feePaymentMethod' in feePaymentMethodInput
  ) {
    const feePaymentMethod = (
      feePaymentMethodInput as WalletWriteExecutionContext
    ).feePaymentMethod;
    if (feePaymentMethod) {
      return feePaymentMethod;
    }
  }

  return defaultFeePaymentMethod;
};

export const createWalletExecutionClient = (
  params: CreateWalletExecutionClientParams
): AztecExecutionClient | null => {
  const {
    connector,
    account,
    isConnected,
    feePaymentConfig,
    defaultFeePaymentMethod,
  } = params;

  if (!isConnected || !connector) {
    return null;
  }

  const executeRead = async (readParams: ReadExecutionParams) => {
    if (isBrowserWalletConnector(connector)) {
      return executeBrowserWalletRead({
        executeOperation: (op) => connector.executeOperation(op),
        getCaipAccount: () => connector.getCaipAccount(),
        address: readParams.address,
        functionName: readParams.functionName,
        args: readParams.args,
      });
    }

    if (!account) {
      throw new Error('Account not available');
    }

    if (hasAppManagedPXE(connector)) {
      const wallet = connector.getWallet();
      if (!wallet) {
        throw new Error('Wallet instance not available');
      }

      return executeAppManagedRead({
        wallet,
        fromAddress: account.getAddress(),
        artifact: readParams.artifact,
        address: readParams.address,
        functionName: readParams.functionName,
        args: readParams.args,
      });
    }

    throw new Error('Unknown wallet type');
  };

  const executeBatchRead = async (batchParams: BatchReadExecutionParams) => {
    if (isBrowserWalletConnector(connector)) {
      return executeBrowserWalletBatch({
        executeOperation: (op) => connector.executeOperation(op),
        getCaipAccount: () => connector.getCaipAccount(),
        contracts: batchParams.contracts,
        allowFailure: batchParams.allowFailure,
      });
    }

    if (!account) {
      throw new Error('Account not available');
    }

    if (hasAppManagedPXE(connector)) {
      const wallet = connector.getWallet();
      if (!wallet) {
        throw new Error('Wallet instance not available');
      }

      return executeAppManagedBatch({
        wallet,
        fromAddress: account.getAddress(),
        contracts: batchParams.contracts,
        allowFailure: batchParams.allowFailure,
      });
    }

    throw new Error('Unknown wallet type');
  };

  const executeWrite = async (writeParams: WriteExecutionParams) => {
    if (isBrowserWalletConnector(connector)) {
      return executeBrowserWalletWrite({
        sendTransaction: (req) => connector.sendTransaction(req),
        executeOperation: (op) => connector.executeOperation(op),
        getCaipAccount: () => connector.getCaipAccount(),
        artifact: writeParams.artifact,
        address: writeParams.address,
        functionName: writeParams.functionName,
        args: writeParams.args,
        receiptPolling: writeParams.receiptPolling,
      });
    }

    if (!account) {
      throw new Error('Account not available');
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
        artifact: writeParams.artifact,
        address: writeParams.address,
        functionName: writeParams.functionName,
        args: writeParams.args,
        createFeePaymentMethod: async (feePaymentMethod) => {
          const method = resolveFeePaymentMethod(
            feePaymentMethod,
            defaultFeePaymentMethod
          );
          return createFeePaymentMethod(method, feePaymentContext);
        },
        feePaymentMethod: writeParams.feePaymentMethod,
        timeout: writeParams.timeout ?? 900,
      });
    }

    throw new Error('Unknown wallet type');
  };

  return {
    executeRead,
    executeBatchRead,
    executeWrite,
  };
};
