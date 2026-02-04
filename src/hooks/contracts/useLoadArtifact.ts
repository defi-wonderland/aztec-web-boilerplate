import { useCallback } from 'react';
import {
  useContractActions,
  useArtifactActions,
  getContractInteractionStore,
} from '../../store';
import {
  cacheAndPersistArtifact,
  getCacheStatusMessage,
} from '../../utils/contractCache';
import { loadAndPrepareArtifact } from '../../utils/contractInteraction';
import { requestPersistentStorage } from '../../utils/indexeddb';
import type { AztecNetwork } from '../../config/networks/constants';

/**
 * Lightweight hook that provides artifact loading functionality.
 * Uses Zustand store for state management, allowing any component
 * to trigger artifact loading with shared state.
 */
export const useLoadArtifact = (networkName?: AztecNetwork) => {
  const { setInvokeTarget, pushLog } = useContractActions();
  const { setSavedContracts, setArtifactState } = useArtifactActions();

  const loadArtifactWithData = useCallback(
    async (
      loadAddress: string,
      loadArtifactJson: string,
      customLabel?: string
    ) => {
      requestPersistentStorage();

      const result = loadAndPrepareArtifact(loadArtifactJson, loadAddress);

      if (!result.success) {
        setArtifactState({ error: result.error });
        pushLog({
          level: 'error',
          title: 'Artifact parse failed',
          detail: result.error.message,
        });
        return;
      }

      const {
        parsed: parsedArtifact,
        address: resolvedAddress,
        contractLabel,
      } = result;

      setArtifactState({ parsed: parsedArtifact, error: null });
      setInvokeTarget(resolvedAddress, null);
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions`,
      });

      const cacheResult = await cacheAndPersistArtifact({
        address: resolvedAddress,
        artifactInput: loadArtifactJson,
        label: customLabel ?? contractLabel,
        savedContracts: getContractInteractionStore().savedContracts,
        networkName,
      });
      setSavedContracts(cacheResult.updatedContracts);

      const cacheMsg = getCacheStatusMessage(cacheResult.stored);
      if (cacheMsg) {
        pushLog({
          level: 'info',
          title: 'Cached address only',
          detail: cacheMsg,
        });
      }
    },
    [networkName, setInvokeTarget, setArtifactState, setSavedContracts, pushLog]
  );

  return loadArtifactWithData;
};
