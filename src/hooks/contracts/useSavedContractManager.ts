import { useCallback } from 'react';
import {
  useContractTargetAddress,
  useContractActions,
  useArtifactActions,
  useFormActions,
  getContractInteractionStore,
} from '../../store';
import {
  clearArtifactsDb,
  clearCachedContract,
  deleteArtifact,
  persistCachedContracts,
  removeContract,
  resolveCachedArtifact,
} from '../../utils/contractCache';
import { getErrorMessage } from '../../utils/errors';
import { useArtifactStateManager } from './useArtifactStateManager';
import type { AztecNetwork } from '../../config/networks/constants';
import type { CachedContract } from '../../utils/contractCache';

export interface UseSavedContractManagerOptions {
  networkName?: AztecNetwork;
  onClearState: () => void;
}

export interface UseSavedContractManagerReturn {
  handleApplySaved: (contract: CachedContract) => Promise<void>;
  handleDeleteSaved: (address: string) => Promise<void>;
  handleClearCache: () => void;
}

/**
 * Hook for managing saved/cached contracts.
 * Handles CRUD operations on the contract cache.
 */
export const useSavedContractManager = (
  options: UseSavedContractManagerOptions
): UseSavedContractManagerReturn => {
  const { networkName, onClearState } = options;

  const address = useContractTargetAddress();
  const { setInvokeTarget, pushLog } = useContractActions();
  const { setArtifactInput, setSavedContracts, setArtifactState } =
    useArtifactActions();
  const { reset: resetFormValues } = useFormActions();
  const { parseAndSetArtifact } = useArtifactStateManager();

  const handleApplySaved = useCallback(
    async (contract: CachedContract) => {
      setInvokeTarget(contract.address, null);
      setArtifactInput('');
      setArtifactState({ error: null });
      resetFormValues();

      const resolved = await resolveCachedArtifact(contract);
      if (!resolved.found) {
        setArtifactState({ parsed: null });
        const detail =
          resolved.reason === 'extended_storage_unavailable'
            ? 'Cached artifact unavailable (too large / cleared); paste it to load functions.'
            : 'Artifact not cached (too large); paste it to load functions.';
        pushLog({ level: 'info', title: 'Address applied', detail });
        return;
      }

      const result = parseAndSetArtifact(resolved.artifact);
      if (result.success) {
        setArtifactInput(resolved.artifact);
        pushLog({
          level: 'success',
          title: 'Saved contract loaded',
          detail: `Loaded ${result.parsed.functions.length} functions from cache`,
        });
      } else {
        pushLog({
          level: 'error',
          title: 'Cached artifact parse failed',
          detail: getErrorMessage(result.error),
        });
      }
    },
    [
      setInvokeTarget,
      setArtifactInput,
      setArtifactState,
      resetFormValues,
      pushLog,
      parseAndSetArtifact,
    ]
  );

  const handleDeleteSaved = useCallback(
    async (targetAddress: string) => {
      const currentContracts = getContractInteractionStore().savedContracts;
      const target = currentContracts.find(
        (c) => c.address.toLowerCase() === targetAddress.toLowerCase()
      );
      if (target?.artifactKey) await deleteArtifact(target.artifactKey);

      const next = removeContract(currentContracts, targetAddress);
      setSavedContracts(next);
      persistCachedContracts(next, networkName);

      if (address.toLowerCase() === targetAddress.toLowerCase()) {
        onClearState();
      }
      pushLog({
        level: 'info',
        title: 'Saved contract removed',
        detail: targetAddress,
      });
    },
    [address, networkName, setSavedContracts, onClearState, pushLog]
  );

  const handleClearCache = useCallback(() => {
    clearCachedContract(networkName);
    clearArtifactsDb();
    setSavedContracts([]);
    onClearState();
    pushLog({ level: 'info', title: 'Cleared' });
  }, [networkName, setSavedContracts, onClearState, pushLog]);

  return {
    handleApplySaved,
    handleDeleteSaved,
    handleClearCache,
  };
};
