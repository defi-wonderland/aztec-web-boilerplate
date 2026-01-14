/**
 * Fee Payment Provider
 *
 * Provides fee payment method selection context.
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import {
  FeePaymentMethodType,
  FEE_PAYMENT_METHOD_LABELS,
  FEE_PAYMENT_METHOD_DESCRIPTIONS,
  getAvailableFeePaymentMethods,
} from '../config/feePaymentContracts';
import type { FeePaymentContractsConfig } from '../config/networks/types';
import { createFeePaymentMethod } from '../services/aztec/feePayment';

export interface FeePaymentMethodInfo {
  type: FeePaymentMethodType;
  label: string;
  description: string;
}

export interface FeePaymentContextType {
  selectedMethod: FeePaymentMethodType;
  setSelectedMethod: (method: FeePaymentMethodType) => void;
  availableMethods: FeePaymentMethodInfo[];
  getFeePaymentMethod: (
    getSponsoredFeePaymentMethod: () => Promise<FeePaymentMethod>
  ) => Promise<FeePaymentMethod>;
}

const FeePaymentContext = createContext<FeePaymentContextType | undefined>(
  undefined
);

interface FeePaymentProviderProps {
  children: ReactNode;
  feePaymentConfig?: FeePaymentContractsConfig;
}

export const FeePaymentProvider: React.FC<FeePaymentProviderProps> = ({
  children,
  feePaymentConfig,
}) => {
  const [selectedMethod, setSelectedMethod] =
    useState<FeePaymentMethodType>('sponsored');

  const availableMethodTypes = useMemo(
    () => getAvailableFeePaymentMethods(feePaymentConfig),
    [feePaymentConfig]
  );

  const availableMethods: FeePaymentMethodInfo[] = useMemo(
    () =>
      availableMethodTypes.map((type) => ({
        type,
        label: FEE_PAYMENT_METHOD_LABELS[type],
        description: FEE_PAYMENT_METHOD_DESCRIPTIONS[type],
      })),
    [availableMethodTypes]
  );

  // Reset to sponsored if selected method becomes unavailable
  React.useEffect(() => {
    if (!availableMethodTypes.includes(selectedMethod)) {
      setSelectedMethod('sponsored');
    }
  }, [availableMethodTypes, selectedMethod]);

  const getFeePaymentMethod = useCallback(
    async (
      getSponsoredFeePaymentMethod: () => Promise<FeePaymentMethod>
    ): Promise<FeePaymentMethod> => {
      return createFeePaymentMethod(selectedMethod, {
        config: feePaymentConfig ?? {},
        getSponsoredFeePaymentMethod,
      });
    },
    [selectedMethod, feePaymentConfig]
  );

  const contextValue: FeePaymentContextType = useMemo(
    () => ({
      selectedMethod,
      setSelectedMethod,
      availableMethods,
      getFeePaymentMethod,
    }),
    [selectedMethod, availableMethods, getFeePaymentMethod]
  );

  return (
    <FeePaymentContext.Provider value={contextValue}>
      {children}
    </FeePaymentContext.Provider>
  );
};

/**
 * Hook to access fee payment context.
 */
export const useFeePayment = (): FeePaymentContextType => {
  const context = useContext(FeePaymentContext);
  if (!context) {
    throw new Error('useFeePayment must be used within FeePaymentProvider');
  }
  return context;
};
