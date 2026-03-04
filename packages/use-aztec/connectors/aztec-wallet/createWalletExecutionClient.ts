import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import {
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '@aztec-wallet';
import {
  executeAppManagedBatch,
  executeAppManagedRead,
  executeAppManagedWrite,
  executeBrowserWalletBatch,
  executeBrowserWalletRead,
  executeBrowserWalletWrite,
} from '../../core';
import type { WalletConnector } from '@aztec-wallet';
import type { FeePaymentMethodType } from '../../types/contractTypes';
import type {
  AztecExecutionClient,
  BatchReadExecutionParams,
  ReadExecutionParams,
  WriteExecutionParams,
} from '../../types/execution';

/** Context passed to the fee payment method factory. */
export interface FeePaymentContext {
  config: Record<string, unknown>;
  getSponsoredFeePaymentMethod: () => Promise<FeePaymentMethod>;
}

export interface CreateWalletExecutionClientParams {
  connector: WalletConnector | null;
  account: AccountWithSecretKey | null;
  isConnected: boolean;
  feePaymentConfig?: Record<string, unknown>;
  defaultFeePaymentMethod: FeePaymentMethodType;
  /** Factory to create a fee payment method instance from a method name. */
  createFeePaymentMethod: (
    method: FeePaymentMethodType,
    context: FeePaymentContext
  ) => Promise<FeePaymentMethod>;
  /** Set of valid fee payment method names for validation. */
  validFeePaymentMethods?: Set<string>;
}

const resolveFeePaymentMethod = (
  feePaymentMethodInput: unknown,
  defaultFeePaymentMethod: FeePaymentMethodType,
  validMethods?: Set<string>
): FeePaymentMethodType => {
  if (
    typeof feePaymentMethodInput === 'string' &&
    feePaymentMethodInput &&
    (!validMethods || validMethods.has(feePaymentMethodInput))
  ) {
    return feePaymentMethodInput as FeePaymentMethodType;
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
    createFeePaymentMethod,
    validFeePaymentMethods,
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

  const executeBatchRead = async <TAllowFailure extends boolean>(
    batchParams: BatchReadExecutionParams<TAllowFailure>
  ) => {
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
            defaultFeePaymentMethod,
            validFeePaymentMethods
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
