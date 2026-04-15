import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import {
  FEE_PAYMENT_METHOD_LABELS,
  type FeePaymentMethodType,
} from '../../config/feePaymentContracts';
import { createFeePaymentMethod } from '../../services/aztec/feePayment/index';
import {
  executeAppManagedBatch,
  executeAppManagedRead,
  executeAppManagedWrite,
} from '../execution';
import type { FeePaymentContractsConfig } from '../../config/networks/types';
import type { FeePaymentContext } from '../../services/aztec/feePayment/index';
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
    if (!account) {
      throw new Error('Account not available');
    }

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
  };

  const executeBatchRead = async <TAllowFailure extends boolean>(
    batchParams: BatchReadExecutionParams<TAllowFailure>
  ) => {
    if (!account) {
      throw new Error('Account not available');
    }

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
  };

  const executeWrite = async (writeParams: WriteExecutionParams) => {
    if (!account) {
      throw new Error('Account not available');
    }

    const wallet = connector.getWallet();
    if (!wallet) {
      throw new Error('Wallet instance not available');
    }

    const feePaymentContext: FeePaymentContext = {
      config: feePaymentConfig ?? {},
      getSponsoredFeePaymentMethod: async () => {
        // Only app-managed connectors (embedded/external signer) provide sponsored fee payment.
        if ('getSponsoredFeePaymentMethod' in connector) {
          return (
            connector as {
              getSponsoredFeePaymentMethod: () => Promise<unknown>;
            }
          ).getSponsoredFeePaymentMethod() as ReturnType<
            typeof feePaymentContext.getSponsoredFeePaymentMethod
          >;
        }
        throw new Error(
          'Sponsored fee payment not available for this wallet type'
        );
      },
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
  };

  return {
    executeRead,
    executeBatchRead,
    executeWrite,
  };
};
