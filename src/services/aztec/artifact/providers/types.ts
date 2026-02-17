import type { ContractArtifact } from '@aztec/aztec.js/abi';

export interface ArtifactProviderResult {
  artifacts: Record<string, ContractArtifact>;
  sourceLabel: string;
}

export interface IArtifactProvider {
  loadArtifacts(contractNames: string[]): Promise<ArtifactProviderResult>;
}
