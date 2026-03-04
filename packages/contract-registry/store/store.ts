import { create } from 'zustand';
import type { ContractArtifact } from '@aztec/stdlib/abi';
import type { IContractRegistry, ContractConfigMap } from '../core/types';

export type ContractRegistryStatus = 'initializing' | 'ready' | 'error';
export type ArtifactStatus = 'idle' | 'loading' | 'ready' | 'error';

type State = {
  registry: IContractRegistry<ContractConfigMap> | null;
  status: ContractRegistryStatus;
  artifacts: Record<string, ContractArtifact> | null;
  artifactStatus: ArtifactStatus;
};

type Actions = {
  setRegistry: (registry: IContractRegistry<ContractConfigMap> | null) => void;
  setStatus: (status: ContractRegistryStatus) => void;
  setArtifacts: (artifacts: Record<string, ContractArtifact> | null) => void;
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
