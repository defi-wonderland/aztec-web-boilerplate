import type { AztecNetwork } from './constants';

/**
 * Fee Payment Contracts configuration for a network.
 */
export interface FeePaymentContractsConfig {
  /** Metered FPC address - tracks internal balances, deducts max gas cost */
  metered?: string;
  /** Metered FPC deployment salt */
  meteredSalt?: string;
  /** Metered FPC deployer address */
  meteredDeployer?: string;
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
  /** Fee payment contracts configuration */
  feePaymentContracts?: FeePaymentContractsConfig;
}
