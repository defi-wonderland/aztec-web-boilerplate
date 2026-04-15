import { useMemo } from 'react';
import { useFeePayment } from '../../store/feePayment';
import { createWalletExecutionClient } from '../client/createExecutionClient';
import { useAztecWallet } from './useAztecWallet';

export const useAztecExecutionClient = () => {
  const { connector, isConnected, currentConfig } = useAztecWallet();
  const { method: defaultFeePaymentMethod } = useFeePayment();
  const feePaymentConfig = currentConfig?.feePaymentContracts;

  return useMemo(
    () =>
      createWalletExecutionClient({
        connector,
        isConnected,
        feePaymentConfig,
        defaultFeePaymentMethod,
      }),
    [connector, isConnected, feePaymentConfig, defaultFeePaymentMethod]
  );
};
