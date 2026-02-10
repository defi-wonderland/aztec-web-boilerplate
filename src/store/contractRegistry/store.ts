import { create } from 'zustand';
import type {
  IContractRegistry,
  ContractConfigMap,
} from '../../contract-registry';
import type { ArtifactOverrides } from '../../services/aztec/artifact';
import type {
  ContractRegistryStatus,
  ArtifactStatus,
} from '../../types/artifactRegistry';

type State = {
  registry: IContractRegistry<ContractConfigMap> | null;
  status: ContractRegistryStatus;
  artifacts: ArtifactOverrides | null;
  artifactStatus: ArtifactStatus;
};

type Actions = {
  setRegistry: (registry: IContractRegistry<ContractConfigMap> | null) => void;
  setStatus: (status: ContractRegistryStatus) => void;
  setArtifacts: (artifacts: ArtifactOverrides | null) => void;
  setArtifactStatus: (status: ArtifactStatus) => void;
  reset: () => void;
};

export type ContractRegistryStore = State & Actions;

const INITIAL_STATE: State = {
  registry: null,
  status: 'initializing',
  artifacts: null,
  artifactStatus: 'idle',
};

export const useContractRegistryStore = create<ContractRegistryStore>(
  (set) => ({
    ...INITIAL_STATE,

    setRegistry: (registry) => set({ registry }),
    setStatus: (status) => set({ status }),
    setArtifacts: (artifacts) => set({ artifacts }),
    setArtifactStatus: (artifactStatus) => set({ artifactStatus }),

    reset: () => set(INITIAL_STATE),
  })
);

export const getContractRegistryStore = () =>
  useContractRegistryStore.getState();
