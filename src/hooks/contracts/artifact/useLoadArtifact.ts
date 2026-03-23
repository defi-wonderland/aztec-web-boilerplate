import { useCallback } from 'react';
import {
  getArtifactStorageService,
  type CachedContract,
} from '../../../services/storage';
import {
  useContractActions,
  useArtifactActions,
  getContractInteractionStore,
} from '../../../store';
import { requestPersistentStorage } from '../../../utils/indexeddb';
import { useArtifactStateManager } from './useArtifactStateManager';
import type { AztecNetwork } from '../../../config/networks/constants';

const generateKey = (network?: string): string =>
  `${network ?? 'default'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const upsertContract = (
  list: CachedContract[],
  contract: CachedContract
): CachedContract[] => {
  const filtered = list.filter(
    (c) => c.address.toLowerCase() !== contract.address.toLowerCase()
  );
  return [contract, ...filtered].slice(0, 10);
};

export const useLoadArtifact = (networkName?: AztecNetwork) => {
  const { setInvokeTarget, pushLog } = useContractActions();
  const { setSavedContracts } = useArtifactActions();
  const { loadAndSetArtifact } = useArtifactStateManager();

  return useCallback(
    async (
      loadAddress: string,
      loadArtifactJson: string,
      customLabel?: string
    ) => {
      requestPersistentStorage();

      const result = loadAndSetArtifact(loadArtifactJson, loadAddress);
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to parse artifact');
      }

      const { parsed, address: resolvedAddress, contractLabel } = result;
      const address = resolvedAddress ?? '';
      const label = customLabel ?? contractLabel;

      setInvokeTarget(address, null);
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsed.functions.length} functions`,
      });

      // Cache artifact and update contracts list
      const storage = getArtifactStorageService();
      const key = generateKey(networkName);
      const saved = await storage.save(key, loadArtifactJson);

      const currentContracts = getContractInteractionStore().savedContracts;
      const updatedContracts = upsertContract(currentContracts, {
        address,
        label,
        artifactKey: saved ? key : undefined,
      });

      await storage.saveContracts(networkName, updatedContracts);
      setSavedContracts(updatedContracts);

      if (!saved) {
        pushLog({
          level: 'info',
          title: 'Cached address only',
          detail: 'Failed to cache artifact; saved contract address only.',
        });
      }
    },
    [
      networkName,
      setInvokeTarget,
      setSavedContracts,
      pushLog,
      loadAndSetArtifact,
    ]
  );
};
