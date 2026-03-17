import { useMemo } from 'react';
import { useFeePayment } from '../../store/feePayment';
import { getNetworkDeployments } from '../../utils/deployments';
import { createWalletExecutionClient } from '../client/createExecutionClient';
import { useAztecWallet } from './useAztecWallet';

export const useAztecExecutionClient = () => {
  const { connector, account, isConnected, networkName } = useAztecWallet();
  const { method: defaultFeePaymentMethod } = useFeePayment();
  const feePaymentConfig = networkName
    ? getNetworkDeployments(networkName)
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
