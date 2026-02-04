/**
 * Storage operations for contract caching.
 * Handles both localStorage (contract metadata) and IndexedDB (large artifacts).
 */

import { IndexedDBStore } from '../storage/IndexedDBStore';
import type { CachedContract } from './types';

// =============================================================================
// Constants
// =============================================================================

const ARTIFACT_DB = 'aztec-contract-artifacts';
const ARTIFACT_STORE = 'artifacts';

const contractCacheKey = (networkName?: string) =>
  `aztec-contract-cache${networkName ? `:${networkName}` : ''}`;

// =============================================================================
// Browser API Helper
// =============================================================================

const getLocalStorage = (): Storage | null =>
  typeof window === 'undefined' ? null : window.localStorage;

// =============================================================================
// IndexedDB Store Instance (Large Artifacts)
// =============================================================================

/**
 * Shared IndexedDB store instance for contract artifacts.
 * Lazy-initialized on first use.
 */
let artifactStore: IndexedDBStore<string> | null = null;

const getArtifactStore = (): IndexedDBStore<string> => {
  if (!artifactStore) {
    artifactStore = new IndexedDBStore<string>({
      dbName: ARTIFACT_DB,
      storeName: ARTIFACT_STORE,
    });
  }
  return artifactStore;
};

// =============================================================================
// IndexedDB Operations (Large Artifacts)
// =============================================================================

/**
 * Generates a unique key for storing an artifact.
 */
const generateArtifactKey = (namespace?: string): string => {
  const sanitizedNamespace = (namespace ?? 'global').replace(
    /[^a-z0-9_-]/gi,
    ''
  );
  return `${sanitizedNamespace}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Stores a large artifact in IndexedDB.
 * @returns The storage key, or null if storage failed
 */
export const storeArtifact = async (
  artifact: string,
  namespace?: string
): Promise<string | null> => {
  const store = getArtifactStore();
  if (!store.isAvailable()) return null;

  const key = generateArtifactKey(namespace);
  const success = await store.save(key, artifact);
  return success ? key : null;
};

/**
 * Loads an artifact from IndexedDB by key.
 */
export const loadArtifact = async (key?: string): Promise<string | null> => {
  if (!key) return null;
  return getArtifactStore().get(key);
};

/**
 * Deletes an artifact from IndexedDB by key.
 */
export const deleteArtifact = async (key?: string): Promise<void> => {
  if (!key) return;
  await getArtifactStore().delete(key);
};

/**
 * Clears the entire artifacts IndexedDB database.
 */
export const clearArtifactsDb = async (): Promise<void> => {
  await getArtifactStore().deleteDatabase();
  // Reset the store instance so it can be re-created if needed
  artifactStore = null;
};

// =============================================================================
// LocalStorage Operations (Contract Metadata)
// =============================================================================

/**
 * Loads cached contracts from localStorage.
 */
export const loadCachedContracts = (networkName?: string): CachedContract[] => {
  const storage = getLocalStorage();
  if (!storage) return [];
  const raw = storage.getItem(contractCacheKey(networkName));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const value = item as Partial<CachedContract>;
        if (typeof value?.address !== 'string') return null;

        const result: CachedContract = { address: value.address };
        if (typeof value.artifact === 'string')
          result.artifact = value.artifact;
        if (typeof value.artifactKey === 'string')
          result.artifactKey = value.artifactKey;
        if (typeof value.label === 'string') result.label = value.label;
        if (typeof value.savedAt === 'number') result.savedAt = value.savedAt;

        return result;
      })
      .filter((item): item is CachedContract => item !== null);
  } catch {
    return [];
  }
};

/**
 * Persists cached contracts to localStorage.
 * Falls back to saving without artifacts if storage quota exceeded.
 */
export const persistCachedContracts = (
  contracts: CachedContract[],
  networkName?: string,
  maxContracts: number = 10
): { savedArtifacts: boolean } => {
  const storage = getLocalStorage();
  if (!storage) return { savedArtifacts: false };
  const key = contractCacheKey(networkName);
  const sanitized = contracts.slice(0, maxContracts);
  const attemptSave = (payload: CachedContract[]) => {
    storage.setItem(key, JSON.stringify(payload));
  };
  try {
    attemptSave(sanitized);
    return {
      savedArtifacts: sanitized.some((c) => Boolean(c.artifact)),
    };
  } catch {
    const stripped = sanitized.map((c) => ({
      address: c.address,
      label: c.label,
      savedAt: c.savedAt,
      artifactKey: c.artifactKey,
    }));
    try {
      attemptSave(stripped);
    } catch {
      // ignore
    }
    return { savedArtifacts: false };
  }
};

/**
 * Clears cached contracts from localStorage.
 */
export const clearCachedContract = (networkName?: string): void => {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(contractCacheKey(networkName));
};
