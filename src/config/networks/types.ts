import type { AztecNetwork } from './constants';

export type ArtifactSource = 'local' | 'registry';

export interface NetworkConfig {
  name: AztecNetwork;
  displayName: string;
  description: string;
  nodeUrl: string;
  deployerAddress: string;
  dripperContractAddress: string;
  dripperDeploymentSalt: string;
  tokenContractAddress: string;
  tokenDeploymentSalt: string;
  proverEnabled: boolean;
  isTestnet: boolean;
  artifactSource: ArtifactSource;
  artifactRegistryUrl?: string;
  classIds?: Record<string, string>;
}
