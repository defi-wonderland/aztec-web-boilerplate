import type { ContractArtifact } from '@aztec/aztec.js/abi';

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

/**
 * Cached artifact record stored in IndexedDB.
 */
export interface CachedArtifact {
  classId: string;
  artifact: SerializedArtifact;
}

/**
 * Source of an artifact: memory cache, IndexedDB cache, or network fetch.
 */
export type ArtifactSource = 'memory' | 'indexeddb' | 'network';

/**
 * Result of getting an artifact, includes the artifact and its source.
 */
export interface ArtifactResult {
  artifact: ContractArtifact;
  source: ArtifactSource;
}

/**
 * Options for getting an artifact.
 */
export interface GetArtifactOptions {
  skipValidation?: boolean;
}
