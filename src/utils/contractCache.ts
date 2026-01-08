const contractCacheKey = (networkName?: string) =>
  `aztec-contract-cache${networkName ? `:${networkName}` : ''}`;

const MAX_CACHE_CHARS = 400_000;
const MAX_SAVED_CONTRACTS = 10;
const ARTIFACT_DB = 'aztec-contract-artifacts';
const ARTIFACT_STORE = 'artifacts';

export type CachedContract = {
  address: string;
  artifact?: string;
  artifactKey?: string;
  label?: string;
  savedAt?: number;
};

const getLocalStorage = (): Storage | null =>
  typeof window === 'undefined' ? null : window.localStorage;

const getIndexedDB = (): IDBFactory | null =>
  typeof window === 'undefined' ? null : (window.indexedDB ?? null);

const openArtifactDb = async (): Promise<IDBDatabase | null> => {
  const indexedDB = getIndexedDB();
  if (!indexedDB) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(ARTIFACT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARTIFACT_STORE)) {
        db.createObjectStore(ARTIFACT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
};

export const storeArtifact = async (
  artifact: string,
  namespace?: string
): Promise<string | null> => {
  const db = await openArtifactDb();
  if (!db) return null;
  const sanitizedNamespace = (namespace ?? 'global').replace(
    /[^a-z0-9_-]/gi,
    ''
  );
  const key = `${sanitizedNamespace}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE, 'readwrite');
    tx.objectStore(ARTIFACT_STORE).put(artifact, key);
    tx.oncomplete = () => resolve(key);
    tx.onerror = () => resolve(null);
  });
};

export const loadArtifact = async (key?: string): Promise<string | null> => {
  if (!key) return null;
  const db = await openArtifactDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE, 'readonly');
    const req = tx.objectStore(ARTIFACT_STORE).get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
};

export const deleteArtifact = async (key?: string): Promise<void> => {
  if (!key) return;
  const db = await openArtifactDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE, 'readwrite');
    tx.objectStore(ARTIFACT_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

export const clearArtifactsDb = async () => {
  const indexedDB = getIndexedDB();
  if (!indexedDB) return;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(ARTIFACT_DB);
    req.onsuccess = () => resolve(null);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
};

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

export const persistCachedContracts = (
  contracts: CachedContract[],
  networkName?: string
): { savedArtifacts: boolean } => {
  const storage = getLocalStorage();
  if (!storage) return { savedArtifacts: false };
  const key = contractCacheKey(networkName);
  const sanitized = contracts.slice(0, MAX_SAVED_CONTRACTS);
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

export const clearCachedContract = (networkName?: string) => {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(contractCacheKey(networkName));
};

export const upsertContract = (
  current: CachedContract[],
  next: CachedContract
): CachedContract[] => {
  const normalizedAddress = next.address.toLowerCase();
  const filtered = current.filter(
    (item) => item.address.toLowerCase() !== normalizedAddress
  );
  const entry: CachedContract = {
    ...next,
    savedAt: Date.now(),
  };
  return [entry, ...filtered].slice(0, MAX_SAVED_CONTRACTS);
};

export const removeContract = (
  current: CachedContract[],
  address: string
): CachedContract[] => {
  const normalized = address.toLowerCase();
  return current.filter((item) => item.address.toLowerCase() !== normalized);
};

export const constants = {
  MAX_CACHE_CHARS,
  MAX_SAVED_CONTRACTS,
};

export type CacheArtifactParams = {
  address: string;
  artifactInput: string;
  label?: string;
  shouldCacheInline: boolean;
  savedContracts: CachedContract[];
  networkName?: string;
};

export type CacheArtifactResult = {
  updatedContracts: CachedContract[];
  savedArtifacts: boolean;
  storedInExtended: boolean;
};

/**
 * Returns a user-friendly message describing the cache result.
 */
export const getCacheStatusMessage = (
  result: CacheArtifactResult,
  shouldCacheInline: boolean
): string | null => {
  if (result.savedArtifacts) return null;

  if (shouldCacheInline)
    return 'Storage quota reached; saved contract address only.';
  if (result.storedInExtended) return 'Artifact cached in extended storage.';
  return 'Artifact too large to cache; saved contract address only.';
};

/**
 * Caches a contract artifact either inline or in extended IndexedDB storage,
 * then persists the updated contract list.
 */
export const cacheAndPersistArtifact = async ({
  address,
  artifactInput,
  label,
  shouldCacheInline,
  savedContracts,
  networkName,
}: CacheArtifactParams): Promise<CacheArtifactResult> => {
  let artifactKey: string | undefined;
  let artifactValue: string | undefined = artifactInput;

  if (!shouldCacheInline) {
    artifactKey =
      (await storeArtifact(artifactInput, networkName)) ?? undefined;
    artifactValue = undefined;
  }

  const upserted = upsertContract(savedContracts, {
    address,
    label,
    artifact: shouldCacheInline ? artifactValue : undefined,
    artifactKey,
  });

  const { savedArtifacts } = persistCachedContracts(upserted, networkName);

  return {
    updatedContracts: upserted,
    savedArtifacts,
    storedInExtended: Boolean(artifactKey),
  };
};

export type ResolvedArtifactResult =
  | {
      found: true;
      artifact: string;
    }
  | {
      found: false;
      reason: 'no_artifact' | 'extended_storage_unavailable';
    };

/**
 * Resolves artifact from a cached contract, checking inline storage first,
 * then extended IndexedDB storage if needed.
 */
export const resolveCachedArtifact = async (
  contract: CachedContract
): Promise<ResolvedArtifactResult> => {
  if (contract.artifact) {
    return { found: true, artifact: contract.artifact };
  }

  if (contract.artifactKey) {
    const artifact = await loadArtifact(contract.artifactKey);
    if (artifact) {
      return { found: true, artifact };
    }
    return { found: false, reason: 'extended_storage_unavailable' };
  }

  return { found: false, reason: 'no_artifact' };
};
