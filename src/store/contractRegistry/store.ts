import { create } from 'zustand';
import type {
  IContractRegistry,
  ContractConfigMap,
} from '../../contract-registry';
import type { ArtifactOverrides } from '../../services/aztec/artifact';
import type {
  ContractRegistryStatus,
  ArtifactStatus,
  TimingInfo,
} from '../../types/artifactRegistry';
import type { ArtifactError } from '../../utils/errors';

type State = {
  registry: IContractRegistry<ContractConfigMap> | null;
  status: ContractRegistryStatus;
  error: Error | undefined;
  timingInfo: TimingInfo | null;
  artifacts: ArtifactOverrides | null;
  artifactStatus: ArtifactStatus;
  artifactError: ArtifactError | null;
};

type Actions = {
  setRegistry: (registry: IContractRegistry<ContractConfigMap> | null) => void;
  setStatus: (status: ContractRegistryStatus) => void;
  setError: (error: Error | undefined) => void;
  setTimingInfo: (info: TimingInfo | null) => void;
  setArtifacts: (artifacts: ArtifactOverrides | null) => void;
  setArtifactStatus: (status: ArtifactStatus) => void;
  setArtifactError: (error: ArtifactError | null) => void;
  reset: () => void;
};

export type ContractRegistryStore = State & Actions;

const INITIAL_STATE: State = {
  registry: null,
  status: 'initializing',
  error: undefined,
  timingInfo: null,
  artifacts: null,
  artifactStatus: 'idle',
  artifactError: null,
};

export const useContractRegistryStore = create<ContractRegistryStore>(
  (set) => ({
    ...INITIAL_STATE,

    setRegistry: (registry) => set({ registry }),
    setStatus: (status) => set({ status }),
    setError: (error) => set({ error }),
    setTimingInfo: (timingInfo) => set({ timingInfo }),
    setArtifacts: (artifacts) => set({ artifacts }),
    setArtifactStatus: (artifactStatus) => set({ artifactStatus }),
    setArtifactError: (artifactError) => set({ artifactError }),

    reset: () => set(INITIAL_STATE),
  })
);

export const getContractRegistryStore = () =>
  useContractRegistryStore.getState();
