import type { ContractArtifact } from '@aztec/aztec.js/abi';

/**
 * Artifact overrides per network. Keys are contract names, values are artifacts.
 * Used to override contract artifacts when loading from external registry.
 */
export type ArtifactOverrides = Record<string, ContractArtifact>;
