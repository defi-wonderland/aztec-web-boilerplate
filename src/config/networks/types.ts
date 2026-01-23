import type { AztecNetwork } from './constants';

export type ArtifactSource = 'local' | 'registry';

export interface NetworkConfig {
  name: AztecNetwork;
  displayName: string;
  description: string;
  nodeUrl: string;
  deployerAddress: string;
  dripperContractAddress: string;
  dripperDeploymentSalt: number;
  tokenContractAddress: string;
  tokenDeploymentSalt: number;
  proverEnabled: boolean;
  isTestnet: boolean;
  artifactSource: ArtifactSource;
  artifactRegistryUrl?: string;
  classIds?: Record<string, string>;
}
