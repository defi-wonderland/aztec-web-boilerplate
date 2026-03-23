import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { ParsedArtifact } from './artifact';
import type { ArtifactError } from '../utils/errors';

/**
 * Serialized artifact for IndexedDB storage.
 * Uses Omit to derive from ContractArtifact, replacing Buffer bytecode with string.
 */
export type SerializedArtifact = Omit<ContractArtifact, 'functions'> & {
  functions: Array<
    Omit<ContractArtifact['functions'][number], 'bytecode'> & {
      bytecode: string;
    }
  >;
};

/** Status of the contract registry initialization */
export type ContractRegistryStatus = 'initializing' | 'ready' | 'error';

/** Status of an artifact loading operation */
export type ArtifactStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Update payload for artifact state in stores */
export interface ArtifactStateUpdate {
  parsed?: ParsedArtifact | null;
  error?: ArtifactError | null;
  isLoading?: boolean;
}

/**
 * Source of an artifact: memory cache, IndexedDB cache, or network fetch.
 */
export type ArtifactCacheOrigin = 'memory' | 'indexeddb' | 'network';

/**
 * Result of getting an artifact, includes the artifact and its source.
 */
export interface ArtifactResult {
  artifact: ContractArtifact;
  source: ArtifactCacheOrigin;
}

/**
 * Options for getting an artifact.
 */
export interface GetArtifactOptions {
  skipValidation?: boolean;
}
