import { useMemo } from 'react';
import { useAztecWallet } from '../../aztec-wallet';
import { useFeePayment } from '../../store/feePayment';
import { createWalletExecutionClient } from './createWalletExecutionClient';

export const useWalletExecutionClient = () => {
  const { connector, account, isConnected, currentConfig } = useAztecWallet();
  const { method: defaultFeePaymentMethod } = useFeePayment();

  return useMemo(
    () =>
      createWalletExecutionClient({
        connector,
        account,
        isConnected,
        feePaymentConfig: currentConfig?.feePaymentContracts,
        defaultFeePaymentMethod,
      }),
    [connector, account, isConnected, currentConfig, defaultFeePaymentMethod]
  );
};
