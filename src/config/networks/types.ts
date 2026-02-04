import type { AztecNetwork } from './constants';

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
 * Fee Payment Contracts configuration - a map of contract names to their deployment configs.
 */
export type FeePaymentContractsConfig = Record<string, DeployedContractConfig>;

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
  /** Fee payment contracts configuration (keyed by contract name, e.g., 'metered') */
  feePaymentContracts?: Record<string, DeployedContractConfig>;
}
