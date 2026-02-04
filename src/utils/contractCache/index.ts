/**
 * Contract caching utilities.
 *
 * Provides caching for contract artifacts using:
 * - localStorage for contract metadata (addresses, labels)
 * - IndexedDB for large artifacts that exceed localStorage limits
 */

import { upsertContract } from './contractList';
import { storeArtifact, loadArtifact, persistCachedContracts } from './storage';
import type {
  CachedContract,
  CacheArtifactParams,
  CacheArtifactResult,
  ResolvedArtifactResult,
} from './types';

// =============================================================================
// Public API - High-Level Operations
// =============================================================================

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

// =============================================================================
// Re-exports
// =============================================================================

// Types
export type {
  CachedContract,
  CacheArtifactParams,
  CacheArtifactResult,
  ResolvedArtifactResult,
} from './types';

// Storage operations
export {
  storeArtifact,
  loadArtifact,
  deleteArtifact,
  clearArtifactsDb,
  loadCachedContracts,
  persistCachedContracts,
  clearCachedContract,
} from './storage';

// List operations
export {
  upsertContract,
  removeContract,
  constants,
  MAX_CACHE_CHARS,
  MAX_SAVED_CONTRACTS,
} from './contractList';
