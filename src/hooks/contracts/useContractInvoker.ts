import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useContractTargetAddress,
  useContractActions,
  useFormActions,
  useArtifactInput,
  useParsedArtifact,
  useSavedContracts,
  useArtifactActions,
} from '../../store';
import { formatFunctionSignature } from '../../utils/contractInteraction';
import { useFunctionGroups } from '../useFunctionGroups';
import { useContractCaller } from './useContractCaller';
import { useLoadArtifact } from './useLoadArtifact';
import { usePreconfiguredLoader } from './usePreconfiguredLoader';
import { useSavedContractManager } from './useSavedContractManager';
import type {
  FunctionGroup,
  InvokeStatus,
} from '../../components/contract-interaction/types';
import type { AztecNetwork } from '../../config/networks/constants';
import type { CachedContract } from '../../services/storage';
import type { ParsedFunction } from '../../types/artifact';

export interface UseContractInvokerOptions {
  networkName?: AztecNetwork;
  filter?: string;
}

export interface UseContractInvokerReturn {
  // Hook-specific (param-dependent or async state)
  groups: FunctionGroup[];
  status: InvokeStatus;
  error: string | null;
  // Actions
  onLoad: () => Promise<void>;
  onSimulate: (functionName: string) => Promise<void>;
  onExecute: (functionName: string) => Promise<void>;
  onApplySaved: (contract: CachedContract) => Promise<void>;
  onDeleteSaved: (address: string) => Promise<void>;
  onClearCache: () => void;
  onArtifactChange: (value: string) => void;
  onSelectPreconfigured: (id: string | null) => void;
}

export const useContractInvoker = (
  options: UseContractInvokerOptions = {}
): UseContractInvokerReturn => {
  const { networkName, filter = '' } = options;

  // Read from Zustand store
  const address = useContractTargetAddress();
  const { setInvokeTarget } = useContractActions();
  const { reset: resetFormValues } = useFormActions();

  // Artifact state from Zustand
  const savedContracts = useSavedContracts();
  const parsed = useParsedArtifact();
  const artifactInput = useArtifactInput();

  const {
    setArtifactInput,
    refreshSavedContracts,
    resetArtifact,
    setArtifactState,
  } = useArtifactActions();

  const hasAutoLoadedRef = useRef(false);

  // Computed: parsed functions with signatures (needed for groups)
  const parsedFunctions = useMemo<ParsedFunction[]>(() => {
    if (!parsed) return [];
    return parsed.functions.map((fn) => ({
      ...fn,
      signature: formatFunctionSignature(fn),
    }));
  }, [parsed]);

  const { grouped } = useFunctionGroups(parsedFunctions, filter);

  // Helper: clear contract state
  const clearContractState = useCallback(() => {
    resetArtifact();
  }, [resetArtifact]);

  // Compose extracted hooks
  const loadArtifactWithData = useLoadArtifact(networkName);

  const { handleApplySaved, handleDeleteSaved, handleClearCache } =
    useSavedContractManager({
      networkName,
      onClearState: clearContractState,
    });

  const { handleSelectPreconfigured } = usePreconfiguredLoader({
    onClearState: clearContractState,
  });

  const { handleSimulate, handleExecute, isSimulating, isExecuting, error } =
    useContractCaller({ grouped });

  // Computed: status
  const status: InvokeStatus = isSimulating
    ? 'simulating'
    : isExecuting
      ? 'executing'
      : 'idle';

  // Wrapper for load artifact
  const handleLoadArtifact = useCallback(async () => {
    resetFormValues();
    await loadArtifactWithData(address, artifactInput);
  }, [address, artifactInput, loadArtifactWithData, resetFormValues]);

  // Initialize saved contracts on mount or network change
  useEffect(() => {
    hasAutoLoadedRef.current = false;
    refreshSavedContracts(networkName);

    // Reset specific state (not full store to preserve logs)
    setInvokeTarget('', null);
    setArtifactInput('');
    setArtifactState({ parsed: null });
    resetFormValues();
  }, [
    networkName,
    refreshSavedContracts,
    setInvokeTarget,
    setArtifactInput,
    setArtifactState,
    resetFormValues,
  ]);

  // Auto-load the first saved contract
  useEffect(() => {
    if (hasAutoLoadedRef.current || parsed || savedContracts.length === 0)
      return;
    hasAutoLoadedRef.current = true;
    void handleApplySaved(savedContracts[0]);
  }, [parsed, savedContracts, handleApplySaved]);

  return {
    groups: grouped,
    status,
    error,
    onLoad: handleLoadArtifact,
    onSimulate: handleSimulate,
    onExecute: handleExecute,
    onApplySaved: handleApplySaved,
    onDeleteSaved: handleDeleteSaved,
    onClearCache: handleClearCache,
    onArtifactChange: setArtifactInput,
    onSelectPreconfigured: handleSelectPreconfigured,
  };
};
