import { useMemo } from 'react';
import { useAztecWallet } from '@aztec-wallet';
import {
  createWalletExecutionClient,
  type CreateWalletExecutionClientParams,
} from './createWalletExecutionClient';

/** Parameters accepted by the useWalletExecutionClient hook. */
export interface UseWalletExecutionClientParams {
  feePaymentConfig?: CreateWalletExecutionClientParams['feePaymentConfig'];
  defaultFeePaymentMethod: CreateWalletExecutionClientParams['defaultFeePaymentMethod'];
  createFeePaymentMethod: CreateWalletExecutionClientParams['createFeePaymentMethod'];
  validFeePaymentMethods?: Set<string>;
}

export const useWalletExecutionClient = (
  params: UseWalletExecutionClientParams
) => {
  const { connector, account, isConnected } = useAztecWallet();
  const {
    feePaymentConfig,
    defaultFeePaymentMethod,
    createFeePaymentMethod,
    validFeePaymentMethods,
  } = params;

  return useMemo(
    () =>
      createWalletExecutionClient({
        connector,
        account,
        isConnected,
        feePaymentConfig,
        defaultFeePaymentMethod,
        createFeePaymentMethod,
        validFeePaymentMethods,
      }),
    [
      connector,
      account,
      isConnected,
      feePaymentConfig,
      defaultFeePaymentMethod,
      createFeePaymentMethod,
      validFeePaymentMethods,
    ]
  );
};
