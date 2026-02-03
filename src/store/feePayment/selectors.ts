/**
 * Fee Payment Store Selectors
 *
 * Hook selectors for accessing fee payment state.
 */

import { useFeePaymentStore } from './store';

/** Returns the fee payment method and setter */
export const useFeePayment = () => ({
  method: useFeePaymentStore((s) => s.method),
  setMethod: useFeePaymentStore((s) => s.setMethod),
});
