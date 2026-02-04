import { useCallback } from 'react';
import {
  useContractActions,
  useArtifactActions,
  getContractInteractionStore,
} from '../../store';
import {
  cacheAndPersistArtifact,
  constants,
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
  const { setAddress, setPreconfiguredId, pushLog } = useContractActions();
  const { setSavedContracts, setArtifactState } = useArtifactActions();

  const loadArtifactWithData = useCallback(
    async (
      loadAddress: string,
      loadArtifactJson: string,
      customLabel?: string
    ) => {
      requestPersistentStorage();

      const result = loadAndPrepareArtifact(
        loadArtifactJson,
        loadAddress,
        constants.MAX_CACHE_CHARS
      );

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
        shouldCacheInline,
      } = result;

      setArtifactState({ parsed: parsedArtifact, error: null });
      setAddress(resolvedAddress);
      setPreconfiguredId(null);
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions`,
      });

      const cacheResult = await cacheAndPersistArtifact({
        address: resolvedAddress,
        artifactInput: loadArtifactJson,
        label: customLabel ?? contractLabel,
        shouldCacheInline,
        savedContracts: getContractInteractionStore().savedContracts,
        networkName,
      });
      setSavedContracts(cacheResult.updatedContracts);

      const cacheMsg = getCacheStatusMessage(cacheResult, shouldCacheInline);
      if (cacheMsg) {
        pushLog({
          level: 'info',
          title: 'Cached address only',
          detail: cacheMsg,
        });
      }
    },
    [
      networkName,
      setAddress,
      setPreconfiguredId,
      setArtifactState,
      setSavedContracts,
      pushLog,
    ]
  );

  return loadArtifactWithData;
};
