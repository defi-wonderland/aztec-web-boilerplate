import { useCallback } from 'react';
import { useFeePaymentStore, DEFAULT_FEE_PAYMENT_METHOD } from './store';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';

/**
 * Hook to get and set the fee payment type for a specific feature.
 *
 * Each feature maintains its own independent fee payment selection,
 * allowing different parts of the app to have separate fee type choices.
 *
 * @param feature - Unique key identifying the feature (e.g., 'dripper', 'contractUI')
 * @returns The current fee payment type and a setter function
 *
 * @example
 * ```tsx
 * const { feePaymentType, setFeePaymentType } = useFeePaymentType('dripper');
 * ```
 */
export const useFeePaymentType = (feature: string) => {
  const feePaymentType = useFeePaymentStore(
    (s) => s.methods[feature] ?? DEFAULT_FEE_PAYMENT_METHOD
  );
  const setMethod = useFeePaymentStore((s) => s.setMethod);

  const setFeePaymentType = useCallback(
    (type: FeePaymentMethodType) => setMethod(feature, type),
    [setMethod, feature]
  );

  return {
    feePaymentType,
    setFeePaymentType,
  };
};
