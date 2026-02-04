import { create } from 'zustand';
import { loadCachedContracts } from '../../utils/contractCache';
import { getFormStore } from '../form';
import type {
  LogEntry,
  ArtifactLoaderMode,
} from '../../components/contract-interaction/types';
import type { CachedContract } from '../../utils/contractCache';
import type { ParsedArtifact } from '../../utils/contractInteraction';
import type { ArtifactError } from '../../utils/errors';

type State = {
  mode: ArtifactLoaderMode;
  preconfiguredId: string | null;
  address: string;
  deployableId: string | null;
  constructorName: string | null;
  logs: LogEntry[];
  // Artifact state (moved from useContractInvoker local state)
  artifactInput: string;
  parsedArtifact: ParsedArtifact | null;
  parseError: ArtifactError | null;
  savedContracts: CachedContract[];
  isLoadingPreconfigured: boolean;
};

type ArtifactStateUpdate = Partial<{
  parsed: ParsedArtifact | null;
  error: ArtifactError | null;
  isLoading: boolean;
}>;

type Actions = {
  setMode: (mode: ArtifactLoaderMode) => void;
  // Invoke mode
  setInvokeTarget: (address: string, preconfiguredId?: string | null) => void;
  // Deploy mode
  setDeployTarget: (
    deployableId: string | null,
    constructorName?: string | null
  ) => void;
  pushLog: (entry: Omit<LogEntry, 'id'>) => void;
  reset: () => void;
  // Artifact actions
  setArtifactInput: (input: string) => void;
  setSavedContracts: (contracts: CachedContract[]) => void;
  refreshSavedContracts: (networkName?: string) => void;
  resetArtifact: () => void;
  setArtifactState: (update: ArtifactStateUpdate) => void;
};

export type ContractInteractionStore = State & Actions;

const INITIAL_STATE: State = {
  mode: 'existing',
  preconfiguredId: null,
  address: '',
  deployableId: null,
  constructorName: null,
  logs: [],
  // Artifact initial state
  artifactInput: '',
  parsedArtifact: null,
  parseError: null,
  savedContracts: [],
  isLoadingPreconfigured: false,
};

const ARTIFACT_INITIAL_STATE = {
  artifactInput: '',
  parsedArtifact: null,
  parseError: null,
  isLoadingPreconfigured: false,
} as const;

export const useContractInteractionStore = create<ContractInteractionStore>(
  (set) => ({
    ...INITIAL_STATE,

    setMode: (mode) =>
      set((state) => {
        if (state.mode !== mode) {
          getFormStore().reset();
          return { mode };
        }
        return { mode };
      }),

    setInvokeTarget: (address, preconfiguredId = null) => {
      getFormStore().reset();
      set({ address, preconfiguredId });
    },

    setDeployTarget: (deployableId, constructorName = null) => {
      getFormStore().reset();
      set({ deployableId, constructorName });
    },

    pushLog: (entry) =>
      set((state) => ({
        logs: [
          { ...entry, id: `${Date.now()}-${state.logs.length}` },
          ...state.logs,
        ].slice(0, 50),
      })),

    reset: () => {
      getFormStore().reset();
      set(INITIAL_STATE);
    },

    // Artifact actions
    setArtifactInput: (artifactInput) => set({ artifactInput }),

    setSavedContracts: (savedContracts) => set({ savedContracts }),

    refreshSavedContracts: (networkName) => {
      const contracts = loadCachedContracts(networkName);
      set({ savedContracts: contracts });
    },

    resetArtifact: () => {
      getFormStore().reset();
      set(ARTIFACT_INITIAL_STATE);
    },

    setArtifactState: (update) => {
      const mapped: Partial<State> = {};
      if ('parsed' in update) mapped.parsedArtifact = update.parsed;
      if ('error' in update) mapped.parseError = update.error;
      if ('isLoading' in update)
        mapped.isLoadingPreconfigured = update.isLoading;
      set(mapped);
    },
  })
);

export const getContractInteractionStore = () =>
  useContractInteractionStore.getState();
