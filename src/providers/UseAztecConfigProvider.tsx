import React, { useMemo, type ReactNode } from 'react';
import { useAztecWallet } from '../aztec-wallet';
import { useFeePayment } from '../store/feePayment';
import { createUseAztecConfig, UseAztecProvider } from '../use-aztec';

interface UseAztecConfigProviderProps {
  children: ReactNode;
}

/**
 * Bridge component that connects aztec-wallet state to the use-aztec config system.
 * Placed inside AztecWalletProvider, provides UseAztecProvider to children.
 */
export const UseAztecConfigProvider: React.FC<UseAztecConfigProviderProps> = ({
  children,
}) => {
  const { connector, account, isConnected, currentConfig } = useAztecWallet();
  const { method: feeMethod } = useFeePayment();

  const config = useMemo(
    () =>
      createUseAztecConfig({
        connector,
        account,
        isConnected,
        feePaymentConfig: currentConfig?.feePaymentContracts,
        defaultFeePaymentMethod: feeMethod,
      }),
    [connector, account, isConnected, currentConfig, feeMethod]
  );

  return <UseAztecProvider config={config}>{children}</UseAztecProvider>;
};
