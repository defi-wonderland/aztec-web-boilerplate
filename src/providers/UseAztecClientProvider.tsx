import React, { useCallback, type ReactNode } from 'react';
import { useAztecWallet } from '@aztec-wallet';
import {
  UseAztecProvider,
  useWalletExecutionClient,
  type FeePaymentContext,
} from '@use-aztec';
import {
  FEE_PAYMENT_METHOD_LABELS,
  type FeePaymentMethodType,
} from '../features/settings/config/feePayment';
import { createFeePaymentMethod as appCreateFeePaymentMethod } from '../features/settings/services/feePayment';
import { useFeePayment } from '../features/settings/store/feePayment';

interface UseAztecClientProviderProps {
  children: ReactNode;
}

const VALID_FEE_METHODS = new Set<string>(
  Object.keys(FEE_PAYMENT_METHOD_LABELS)
);

/**
 * Bridges aztec-wallet state to an execution-only use-aztec client.
 * Provides app-specific fee payment config to the connector.
 */
export const UseAztecClientProvider: React.FC<UseAztecClientProviderProps> = ({
  children,
}) => {
  const { currentConfig } = useAztecWallet();
  const { method: defaultFeePaymentMethod } = useFeePayment();

  const feePaymentConfig = currentConfig?.feePaymentContracts;

  const createFeePaymentMethod = useCallback(
    (method: FeePaymentMethodType, context: FeePaymentContext) =>
      appCreateFeePaymentMethod(method, context),
    []
  );

  const client = useWalletExecutionClient({
    feePaymentConfig,
    defaultFeePaymentMethod,
    createFeePaymentMethod,
    validFeePaymentMethods: VALID_FEE_METHODS,
  });

  return <UseAztecProvider client={client}>{children}</UseAztecProvider>;
};
