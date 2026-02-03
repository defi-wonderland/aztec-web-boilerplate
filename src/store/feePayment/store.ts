/**
 * Fee Payment Zustand Store
 *
 * Global store for fee payment method selection with localStorage persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';

const STORAGE_KEY = 'aztec-fee-payment';
export const DEFAULT_FEE_PAYMENT_METHOD: FeePaymentMethodType = 'sponsored';

interface FeePaymentState {
  method: FeePaymentMethodType;
}

interface FeePaymentActions {
  setMethod: (method: FeePaymentMethodType) => void;
  reset: () => void;
}

export type FeePaymentStore = FeePaymentState & FeePaymentActions;

export const useFeePaymentStore = create<FeePaymentStore>()(
  persist(
    (set) => ({
      method: DEFAULT_FEE_PAYMENT_METHOD,
      setMethod: (method) => set({ method }),
      reset: () => set({ method: DEFAULT_FEE_PAYMENT_METHOD }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const getFeePaymentStore = () => useFeePaymentStore.getState();
