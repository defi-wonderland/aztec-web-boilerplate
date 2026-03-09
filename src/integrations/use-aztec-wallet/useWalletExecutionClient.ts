import { useMemo } from 'react';
import { useAztecWallet } from '../../aztec-wallet';
import { useFeePayment } from '../../store/feePayment';
import { getNetworkDeployments } from '../../utils/deployments';
import { createWalletExecutionClient } from './createWalletExecutionClient';

export const useWalletExecutionClient = () => {
  const { connector, account, isConnected, currentConfig } = useAztecWallet();
  const { method: defaultFeePaymentMethod } = useFeePayment();
  const feePaymentConfig = currentConfig
    ? getNetworkDeployments(currentConfig.name)
    : undefined;

  return useMemo(
    () =>
      createWalletExecutionClient({
        connector,
        account,
        isConnected,
        feePaymentConfig,
        defaultFeePaymentMethod,
      }),
    [connector, account, isConnected, feePaymentConfig, defaultFeePaymentMethod]
  );
};
