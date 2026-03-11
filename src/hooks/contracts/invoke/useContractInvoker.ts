import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAztecWallet } from '../../../aztec-wallet';
import {
  useContractActions,
  useFormActions,
  useInvokeFlowData,
  useArtifactActions,
} from '../../../store';
import { formatFunctionSignature } from '../../../utils/contractInteraction';
import { useLoadArtifact } from '../artifact/useLoadArtifact';
import { usePreconfiguredLoader } from '../artifact/usePreconfiguredLoader';
import { useSavedContractManager } from '../artifact/useSavedContractManager';
import { useContractCaller } from './useContractCaller';
import { useFunctionGroups } from './useFunctionGroups';
import type {
  FunctionGroup,
  InvokeStatus,
} from '../../../components/contract-interaction/types';
import type { CachedContract } from '../../../services/storage';
import type { ParsedFunction } from '../../../types/artifact';

export interface UseContractInvokerOptions {
  filter?: string;
}

export interface UseContractInvokerReturn {
  // Hook-specific (param-dependent or async state)
  groups: FunctionGroup[];
  status: InvokeStatus;
  error: string | null;
  // Actions
  onLoad: () => Promise<void>;
  onSimulate: (functionName: string) => Promise<string | null>;
  onExecute: (functionName: string) => Promise<string | null>;
  onApplySaved: (contract: CachedContract) => Promise<void>;
  onDeleteSaved: (address: string) => Promise<void>;
  onClearCache: () => void;
  onArtifactChange: (value: string) => void;
  onSelectPreconfigured: (id: string | null) => void;
}

export const useContractInvoker = (
  options: UseContractInvokerOptions = {}
): UseContractInvokerReturn => {
  const { filter = '' } = options;
  const { networkName } = useAztecWallet();

  // Read from Zustand store
  const {
    address,
    savedContracts,
    parsedArtifact: parsed,
    artifactInput,
  } = useInvokeFlowData();
  const { setInvokeTarget } = useContractActions();
  const { reset: resetFormValues } = useFormActions();

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
  const loadArtifactWithData = useLoadArtifact();

  const { handleApplySaved, handleDeleteSaved, handleClearCache } =
    useSavedContractManager({
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
    try {
      await loadArtifactWithData(address, artifactInput);
    } catch {
      // Parse error is already surfaced via store state (artifactError)
    }
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
