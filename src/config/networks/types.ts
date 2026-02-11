import type { AztecNetwork } from './constants';

export type ArtifactSource = 'local' | 'registry';
/**
 * Configuration for a deployed contract on a network.
 * Contains address, deployment salt, and deployer address.
 */
export interface DeployedContractConfig {
  /** Contract address */
  address?: string;
  /** Deployment salt (for deterministic addresses) */
  salt?: string;
  /** Deployer address */
  deployer?: string;
}

/**
 * Fee Payment Contracts configuration.
 * Contains an enabled flag and a map of contract names to their deployment configs.
 */
export interface FeePaymentContractsConfig {
  /** Whether FPC is enabled. When false, transactions are sent without fee payment. */
  enabled: boolean;
  /** Contract deployment configs keyed by name (e.g., 'metered') */
  contracts: Record<string, DeployedContractConfig>;
}

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
  /** Fee payment contracts configuration */
  feePaymentContracts: FeePaymentContractsConfig;
}
