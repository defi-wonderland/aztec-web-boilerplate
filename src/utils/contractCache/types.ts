/**
 * Type definitions for contract caching.
 */

/**
 * Cached contract data stored in localStorage/IndexedDB.
 */
export type CachedContract = {
  address: string;
  artifactKey?: string;
  label?: string;
};

/**
 * Parameters for caching an artifact.
 */
export type CacheArtifactParams = {
  address: string;
  artifactInput: string;
  label?: string;
  savedContracts: CachedContract[];
  networkName?: string;
};

/**
 * Result of caching an artifact.
 */
export type CacheArtifactResult = {
  updatedContracts: CachedContract[];
  stored: boolean;
};

/**
 * Result of resolving a cached artifact.
 */
export type ResolvedArtifactResult =
  | {
      found: true;
      artifact: string;
    }
  | {
      found: false;
      reason: 'no_artifact' | 'extended_storage_unavailable';
    };
