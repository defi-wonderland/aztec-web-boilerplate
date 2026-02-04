/**
 * Contract caching utilities.
 *
 * Provides caching for contract artifacts using:
 * - localStorage for contract metadata (addresses, labels)
 * - IndexedDB for artifacts
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
export const getCacheStatusMessage = (stored: boolean): string | null => {
  if (stored) return null;
  return 'Failed to cache artifact; saved contract address only.';
};

/**
 * Caches a contract artifact in IndexedDB,
 * then persists the updated contract list.
 */
export const cacheAndPersistArtifact = async ({
  address,
  artifactInput,
  label,
  savedContracts,
  networkName,
}: CacheArtifactParams): Promise<CacheArtifactResult> => {
  const artifactKey =
    (await storeArtifact(artifactInput, networkName)) ?? undefined;

  const upserted = upsertContract(savedContracts, {
    address,
    label,
    artifactKey,
  });

  persistCachedContracts(upserted, networkName);

  return {
    updatedContracts: upserted,
    stored: Boolean(artifactKey),
  };
};

/**
 * Resolves artifact from a cached contract by loading from IndexedDB.
 */
export const resolveCachedArtifact = async (
  contract: CachedContract
): Promise<ResolvedArtifactResult> => {
  if (!contract.artifactKey) {
    return { found: false, reason: 'no_artifact' };
  }

  const artifact = await loadArtifact(contract.artifactKey);
  if (artifact) {
    return { found: true, artifact };
  }
  return { found: false, reason: 'extended_storage_unavailable' };
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
  MAX_SAVED_CONTRACTS,
} from './contractList';
