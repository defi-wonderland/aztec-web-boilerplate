/**
 * Fee Payment Zustand Store
 *
 * Per-network fee payment method storage with localStorage persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';

const STORAGE_KEY = 'aztec-fee-payment';
export const DEFAULT_FEE_PAYMENT_METHOD: FeePaymentMethodType = 'sponsored';

interface FeePaymentState {
  /** Fee payment method per network */
  methods: Record<string, FeePaymentMethodType>;
}

interface FeePaymentActions {
  setMethod: (network: string, method: FeePaymentMethodType) => void;
  getMethod: (network: string) => FeePaymentMethodType;
  reset: () => void;
}

export type FeePaymentStore = FeePaymentState & FeePaymentActions;

export const useFeePaymentStore = create<FeePaymentStore>()(
  persist(
    (set, get) => ({
      methods: {},
      setMethod: (network, method) =>
        set((state) => ({
          methods: { ...state.methods, [network]: method },
        })),
      getMethod: (network) =>
        get().methods[network] ?? DEFAULT_FEE_PAYMENT_METHOD,
      reset: () => set({ methods: {} }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const getFeePaymentStore = () => useFeePaymentStore.getState();
