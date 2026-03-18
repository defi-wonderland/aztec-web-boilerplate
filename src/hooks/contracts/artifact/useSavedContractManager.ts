import { useCallback } from 'react';
import { useAztecWallet } from '../../../aztec-wallet';
import {
  getArtifactStorageService,
  type CachedContract,
} from '../../../services/storage';
import {
  useContractTargetAddress,
  useContractActions,
  useArtifactActions,
  useFormActions,
  getContractInteractionStore,
} from '../../../store';
import { getErrorMessage } from '../../../utils/errors';
import { useArtifactStateManager } from './useArtifactStateManager';

export interface UseSavedContractManagerOptions {
  onClearState: () => void;
}

export interface UseSavedContractManagerReturn {
  handleApplySaved: (contract: CachedContract) => Promise<void>;
  handleDeleteSaved: (address: string) => Promise<void>;
  handleClearCache: () => Promise<void>;
}

export const useSavedContractManager = (
  options: UseSavedContractManagerOptions
): UseSavedContractManagerReturn => {
  const { onClearState } = options;
  const { networkName } = useAztecWallet();

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

      if (!contract.artifactKey) {
        setArtifactState({ parsed: null });
        pushLog({
          level: 'info',
          title: 'Address applied',
          detail: 'Artifact not cached; paste it to load functions.',
        });
        return;
      }

      const artifact = await getArtifactStorageService().get(
        contract.artifactKey
      );

      if (!artifact) {
        setArtifactState({ parsed: null });
        pushLog({
          level: 'info',
          title: 'Address applied',
          detail: 'Cached artifact unavailable; paste it to load functions.',
        });
        return;
      }

      const result = parseAndSetArtifact(artifact);
      if (result.success) {
        setArtifactInput(artifact);
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
      if (!networkName) {
        pushLog({
          level: 'error',
          title: 'Cannot delete saved contract',
          detail: 'No network selected',
        });
        return;
      }

      const storage = getArtifactStorageService();
      const currentContracts = getContractInteractionStore().savedContracts;

      const target = currentContracts.find(
        (c) => c.address.toLowerCase() === targetAddress.toLowerCase()
      );
      if (target?.artifactKey) {
        await storage.delete(target.artifactKey);
      }

      const next = currentContracts.filter(
        (c) => c.address.toLowerCase() !== targetAddress.toLowerCase()
      );
      setSavedContracts(next);
      await storage.saveContracts(networkName, next);

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

  const handleClearCache = useCallback(async () => {
    if (!networkName) {
      pushLog({
        level: 'error',
        title: 'Cannot clear cache',
        detail: 'No network selected',
      });
      return;
    }

    const storage = getArtifactStorageService();
    await storage.clearArtifactsForNetwork(networkName);
    await storage.clearContracts(networkName);
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
