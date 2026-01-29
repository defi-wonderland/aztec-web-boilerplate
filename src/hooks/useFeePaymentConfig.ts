/**
 * Hook for fee payment configuration.
 *
 * Provides available methods and factory for creating payment methods.
 * Stateless - does not manage selection state.
 */

import { useMemo, useCallback } from 'react';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import {
  getAvailableFeePaymentMethods,
  FEE_PAYMENT_METHOD_LABELS,
  FEE_PAYMENT_METHOD_DESCRIPTIONS,
} from '../config/feePaymentContracts';
import { createFeePaymentMethod } from '../services/aztec/feePayment';
import { hasAppManagedPXE } from '../types/walletConnector';
import { useUniversalWallet } from './context/useUniversalWallet';
import type { FeePaymentMethodType } from '../config/feePaymentContracts';

export interface FeePaymentMethodInfo {
  type: FeePaymentMethodType;
  label: string;
  description: string;
}

interface UseFeePaymentConfigReturn {
  /** List of available fee payment methods for current network */
  availableMethods: FeePaymentMethodInfo[];
  /** Whether fee payment selection is supported (app-managed PXE only) */
  isSupported: boolean;
  /** Factory to create a FeePaymentMethod instance */
  createPaymentMethod: (
    type: FeePaymentMethodType
  ) => Promise<FeePaymentMethod>;
}

/**
 * Hook providing fee payment configuration and factory.
 * Stateless - does not manage selection.
 */
export const useFeePaymentConfig = (): UseFeePaymentConfigReturn => {
  const { connector, currentConfig } = useUniversalWallet();

  const feePaymentConfig = currentConfig?.feePaymentContracts;

  const isSupported = Boolean(connector && hasAppManagedPXE(connector));

  const availableMethods = useMemo((): FeePaymentMethodInfo[] => {
    const types = getAvailableFeePaymentMethods(feePaymentConfig);
    return types.map((type) => ({
      type,
      label: FEE_PAYMENT_METHOD_LABELS[type],
      description: FEE_PAYMENT_METHOD_DESCRIPTIONS[type],
    }));
  }, [feePaymentConfig]);

  const createPaymentMethod = useCallback(
    async (type: FeePaymentMethodType): Promise<FeePaymentMethod> => {
      if (!connector || !hasAppManagedPXE(connector)) {
        throw new Error('Fee payment requires app-managed PXE wallet');
      }

      return createFeePaymentMethod(type, {
        config: feePaymentConfig ?? {},
        getSponsoredFeePaymentMethod: () =>
          connector.getSponsoredFeePaymentMethod(),
      });
    },
    [connector, feePaymentConfig]
  );

  return {
    availableMethods,
    isSupported,
    createPaymentMethod,
  };
};
