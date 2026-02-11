import { create } from 'zustand';
import {
  getArtifactStorageService,
  type CachedContract,
} from '../../services/storage';
import { getFormStore } from '../form';
import type {
  LogEntry,
  ArtifactLoaderMode,
} from '../../components/contract-interaction/types';
import type { ParsedArtifact } from '../../types/artifact';
import type { ArtifactStateUpdate } from '../../types/artifactRegistry';
import type { ArtifactError } from '../../utils/errors';

type ViewMode = 'setup' | 'explorer';

/**
 * Simulation result to display in the UI
 */
export interface SimulationResult {
  value: string;
  type: string;
  timestamp: Date;
  functionName: string;
}

type State = {
  mode: ArtifactLoaderMode;
  preconfiguredId: string | null;
  address: string;
  deployableId: string | null;
  constructorName: string | null;
  logs: LogEntry[];
  artifactInput: string;
  parsedArtifact: ParsedArtifact | null;
  parseError: ArtifactError | null;
  savedContracts: CachedContract[];
  isLoadingPreconfigured: boolean;
  // UI layout state
  viewMode: ViewMode;
  sidebarSelectedId: string | null;
  // Explorer state
  selectedFunctionName: string | null;
  functionFilter: string;
  simulationResult: SimulationResult | null;
};

type Actions = {
  setMode: (mode: ArtifactLoaderMode) => void;
  // Invoke mode
  setInvokeTarget: (address: string, preconfiguredId?: string | null) => void;
  // Deploy mode
  setDeployTarget: (
    deployableId: string | null,
    constructorName?: string | null
  ) => void;
  pushLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setSelectedConstructor: (constructorName: string | null) => void;
  // Artifact actions
  setArtifactInput: (input: string) => void;
  setSavedContracts: (contracts: CachedContract[]) => void;
  refreshSavedContracts: (networkName?: string) => Promise<void>;
  deleteSavedContract: (address: string, networkName?: string) => Promise<void>;
  reset: () => void;
  resetArtifact: () => void;
  setArtifactState: (update: ArtifactStateUpdate) => void;
  // UI layout actions
  setViewMode: (mode: ViewMode) => void;
  setSidebarSelectedId: (id: string | null) => void;
  // Explorer actions
  setSelectedFunctionName: (name: string | null) => void;
  setFunctionFilter: (filter: string) => void;
  setSimulationResult: (result: SimulationResult | null) => void;
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
  // UI layout initial state
  viewMode: 'setup',
  sidebarSelectedId: null,
  // Explorer initial state
  selectedFunctionName: null,
  functionFilter: '',
  simulationResult: null,
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
      set((state) => {
        const now = Date.now();
        return {
          logs: [
            { ...entry, id: `${now}-${state.logs.length}`, timestamp: now },
            ...state.logs,
          ].slice(0, 50),
        };
      }),

    clearLogs: () => set({ logs: [] }),

    setSelectedConstructor: (constructorName) => {
      getFormStore().reset();
      set({ constructorName });
    },

    // Artifact actions
    setArtifactInput: (artifactInput) => set({ artifactInput }),

    setSavedContracts: (savedContracts) => set({ savedContracts }),

    refreshSavedContracts: async (networkName) => {
      const storage = getArtifactStorageService();
      const contracts = await storage.getContracts(networkName);
      set({ savedContracts: contracts });
    },

    deleteSavedContract: async (address, networkName) => {
      const storage = getArtifactStorageService();
      const state = useContractInteractionStore.getState();
      const contractToDelete = state.savedContracts.find(
        (c) => c.address.toLowerCase() === address.toLowerCase()
      );

      // Delete artifact from IndexedDB if stored there
      if (contractToDelete?.artifactKey) {
        await storage.delete(contractToDelete.artifactKey);
      }

      // Remove from list and persist
      const updated = state.savedContracts.filter(
        (c) => c.address.toLowerCase() !== address.toLowerCase()
      );
      await storage.saveContracts(networkName, updated);
      set({ savedContracts: updated });
    },

    reset: () => {
      getFormStore().reset();
      set(INITIAL_STATE);
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

    // UI layout actions
    setViewMode: (viewMode) => set({ viewMode }),

    setSidebarSelectedId: (sidebarSelectedId) => set({ sidebarSelectedId }),

    // Explorer actions
    setSelectedFunctionName: (selectedFunctionName) => {
      getFormStore().reset();
      set({ selectedFunctionName });
    },

    setFunctionFilter: (functionFilter) => set({ functionFilter }),

    setSimulationResult: (simulationResult) => set({ simulationResult }),
  })
);

export const getContractInteractionStore = () =>
  useContractInteractionStore.getState();
