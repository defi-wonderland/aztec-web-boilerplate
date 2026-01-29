import { create } from 'zustand';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';

/** Default fee payment method when none is explicitly set */
export const DEFAULT_FEE_PAYMENT_METHOD: FeePaymentMethodType = 'sponsored';

type State = {
  methods: Record<string, FeePaymentMethodType>;
};

type Actions = {
  setMethod: (feature: string, method: FeePaymentMethodType) => void;
};

export type FeePaymentStore = State & Actions;

const INITIAL_STATE: State = {
  methods: {},
};

export const useFeePaymentStore = create<FeePaymentStore>((set) => ({
  ...INITIAL_STATE,
  setMethod: (feature, method) =>
    set((state) => ({
      methods: { ...state.methods, [feature]: method },
    })),
}));
