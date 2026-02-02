/**
 * Fee Payment Store Selectors
 *
 * Hook selectors for accessing fee payment state.
 */

import { useFeePaymentStore } from './store';

/** Returns the current fee payment method */
export const useFeePaymentMethod = () => useFeePaymentStore((s) => s.method);

/** Returns the setter for fee payment method */
export const useSetFeePaymentMethod = () =>
  useFeePaymentStore((s) => s.setMethod);

/** Returns both the method and setter for convenience */
export const useFeePaymentState = () => ({
  feePaymentMethod: useFeePaymentStore((s) => s.method),
  setFeePaymentMethod: useFeePaymentStore((s) => s.setMethod),
});
