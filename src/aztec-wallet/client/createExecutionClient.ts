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
  const { connector, isConnected, feePaymentConfig, defaultFeePaymentMethod } =
    params;

  if (!isConnected || !connector) {
    return null;
  }

  const resolveContext = () => {
    const wallet = connector.getWallet();
    if (!wallet) {
      throw new Error('Wallet instance not available');
    }
    const fromAddress = connector.getAddress();
    if (!fromAddress) {
      throw new Error('Account address not available');
    }
    return { wallet, fromAddress };
  };

  const executeRead = async (readParams: ReadExecutionParams) => {
    const { wallet, fromAddress } = resolveContext();
    return executeAppManagedRead({
      wallet,
      fromAddress,
      artifact: readParams.artifact,
      address: readParams.address,
      functionName: readParams.functionName,
      args: readParams.args,
    });
  };

  const executeBatchRead = async <TAllowFailure extends boolean>(
    batchParams: BatchReadExecutionParams<TAllowFailure>
  ) => {
    const { wallet, fromAddress } = resolveContext();
    return executeAppManagedBatch({
      wallet,
      fromAddress,
      contracts: batchParams.contracts,
      allowFailure: batchParams.allowFailure,
    });
  };

  const executeWrite = async (writeParams: WriteExecutionParams) => {
    const { wallet, fromAddress } = resolveContext();

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
      fromAddress,
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
