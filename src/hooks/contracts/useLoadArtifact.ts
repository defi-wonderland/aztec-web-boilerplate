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
import type { AztecNetwork } from '../../config/networks/constants';

const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return;
  const alreadyPersisted = await navigator.storage.persisted();
  if (!alreadyPersisted) {
    await navigator.storage.persist();
  }
};

/**
 * Lightweight hook that provides artifact loading functionality.
 * Uses Zustand store for state management, allowing any component
 * to trigger artifact loading with shared state.
 */
export const useLoadArtifact = (networkName?: AztecNetwork) => {
  const { setAddress, setPreconfiguredId, pushLog } = useContractActions();
  const { setParsedArtifact, setParseError, setSavedContracts } =
    useArtifactActions();

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
        setParseError(result.error ?? 'Parse failed');
        pushLog({
          level: 'error',
          title: 'Artifact parse failed',
          detail: result.error ?? 'Unknown error',
        });
        return;
      }

      const {
        parsed: parsedArtifact,
        address: resolvedAddress,
        contractLabel,
        shouldCacheInline,
      } = result;

      setParsedArtifact(parsedArtifact);
      setAddress(resolvedAddress);
      setPreconfiguredId(null);
      setParseError(null);
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
      setParsedArtifact,
      setParseError,
      setSavedContracts,
      pushLog,
    ]
  );

  return loadArtifactWithData;
};
