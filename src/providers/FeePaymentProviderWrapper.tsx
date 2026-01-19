/**
 * Fee Payment Provider Wrapper
 *
 * Connects FeePaymentProvider to the current network config.
 */

import React, { ReactNode } from 'react';
import { useCurrentNetwork } from '../store/network/selectors';
import { FeePaymentProvider } from './FeePaymentProvider';

interface FeePaymentProviderWrapperProps {
  children: ReactNode;
}

export const FeePaymentProviderWrapper: React.FC<
  FeePaymentProviderWrapperProps
> = ({ children }) => {
  const currentConfig = useCurrentNetwork();

  return (
    <FeePaymentProvider feePaymentConfig={currentConfig?.feePaymentContracts}>
      {children}
    </FeePaymentProvider>
  );
};
