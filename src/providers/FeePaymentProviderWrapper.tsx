/**
 * Fee Payment Provider Wrapper
 *
 * Connects FeePaymentProvider to the current network config.
 */

import React, { ReactNode } from 'react';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { FeePaymentProvider } from './FeePaymentProvider';

interface FeePaymentProviderWrapperProps {
  children: ReactNode;
}

export const FeePaymentProviderWrapper: React.FC<
  FeePaymentProviderWrapperProps
> = ({ children }) => {
  const { currentConfig } = useUniversalWallet();

  return (
    <FeePaymentProvider feePaymentConfig={currentConfig.feePaymentContracts}>
      {children}
    </FeePaymentProvider>
  );
};
