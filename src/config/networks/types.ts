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

export interface NetworkConfig {
  name: AztecNetwork;
  displayName: string;
  description: string;
  nodeUrl: string;
  proverEnabled: boolean;
  isTestnet: boolean;
  /** Fee payment contract deployments for this network */
  feePaymentContracts?: Record<string, DeployedContractConfig>;
}
