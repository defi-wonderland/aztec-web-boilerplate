import type { AztecNetwork } from './constants';

/**
 * Raw public keys as hex strings (for JSON serialization).
 * Each key is a 64-byte hex string representing a Point (x, y coordinates).
 */
export interface RawPublicKeys {
  masterNullifierPublicKey: string;
  masterIncomingViewingPublicKey: string;
  masterOutgoingViewingPublicKey: string;
  masterTaggingPublicKey: string;
}

export interface NetworkConfig {
  name: AztecNetwork;
  displayName: string;
  description: string;
  nodeUrl: string;
  deployerAddress: string;
  dripperContractAddress: string;
  dripperDeploymentSalt: number;
  dripperPublicKeys?: RawPublicKeys;
  tokenContractAddress: string;
  tokenDeploymentSalt: number;
  tokenPublicKeys?: RawPublicKeys;
  proverEnabled: boolean;
  isTestnet: boolean;
  useExternalArtifactRegistry?: boolean;
  artifactRegistryUrl?: string;
  classIds?: Record<string, string>;
}
