import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import {
  FEE_PAYMENT_METHOD_LABELS,
  type FeePaymentMethodType,
} from '../../services/aztec/feePayment/feePaymentMethods';
import { createFeePaymentMethod } from '../../services/aztec/feePayment/index';
import {
  executeAppManagedBatch,
  executeAppManagedRead,
  executeAppManagedWrite,
  executeBrowserWalletBatch,
  executeBrowserWalletRead,
  executeBrowserWalletWrite,
} from '../execution';
import {
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '../types/walletConnector';
import type { FeePaymentContext } from '../../services/aztec/feePayment/index';
import type { FeePaymentContractsConfig } from '../../types/network';
import type {
  AztecExecutionClient,
  BatchReadExecutionParams,
  ReadExecutionParams,
  WriteExecutionParams,
} from '../../use-aztec/types/execution';
import type { WalletConnector } from '../types/walletConnector';

interface CreateWalletExecutionClientParams {
  connector: WalletConnector | null;
  account: AccountWithSecretKey | null;
  isConnected: boolean;
  feePaymentConfig?: FeePaymentContractsConfig;
  defaultFeePaymentMethod: FeePaymentMethodType;
}

const VALID_FEE_METHODS = new Set<string>(
  Object.keys(FEE_PAYMENT_METHOD_LABELS)
);

const isFeePaymentMethodType = (
  value: string
): value is FeePaymentMethodType => {
  return VALID_FEE_METHODS.has(value);
};

const resolveFeePaymentMethod = (
  feePaymentMethodInput: unknown,
  defaultFeePaymentMethod: FeePaymentMethodType
): FeePaymentMethodType => {
  if (
    typeof feePaymentMethodInput === 'string' &&
    feePaymentMethodInput &&
    isFeePaymentMethodType(feePaymentMethodInput)
  ) {
    return feePaymentMethodInput;
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
