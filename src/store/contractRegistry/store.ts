import { create } from 'zustand';

export type ContractRegistryStatus = 'initializing' | 'ready' | 'error';

export type TimingInfo = {
  elapsedMs: number;
  contractCount: number;
  fromCache: boolean;
};

type State = {
  status: ContractRegistryStatus;
  error: Error | undefined;
  timingInfo: TimingInfo | null;
};

type Actions = {
  setStatus: (status: ContractRegistryStatus) => void;
  setError: (error: Error | undefined) => void;
  setTimingInfo: (info: TimingInfo | null) => void;
  reset: () => void;
};

export type ContractRegistryStore = State & Actions;

const INITIAL_STATE: State = {
  status: 'initializing',
  error: undefined,
  timingInfo: null,
};

export const useContractRegistryStore = create<ContractRegistryStore>(
  (set) => ({
    ...INITIAL_STATE,

    setStatus: (status) => set({ status }),
    setError: (error) => set({ error }),
    setTimingInfo: (timingInfo) => set({ timingInfo }),
    reset: () => set(INITIAL_STATE),
  })
);

export const getContractRegistryStore = () =>
  useContractRegistryStore.getState();
