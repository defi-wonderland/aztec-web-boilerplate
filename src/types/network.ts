/**
 * Network type definitions.
 */

/**
 * Supported Aztec network identifiers
 */
export type AztecNetwork = 'sandbox' | 'devnet';

/**
 * Available network types (derived from NETWORK_URLS keys)
 */
export type NetworkType = 'sandbox' | 'devnet';

/**
 * Aztec chain ID type - follows CAIP-2 format
 */
export type AztecChainId = `aztec:${number}`;

/**
 * Network configuration — defines infrastructure properties of a network.
 *
 * Contract deployment data (addresses, salts, deployer) lives in
 * src/config/deployments/ and is resolved by the registry at runtime.
 */
export interface NetworkConfig {
  name: AztecNetwork;
  displayName: string;
  description: string;
  nodeUrl: string;
  proverEnabled: boolean;
  isTestnet: boolean;
}

/**
 * Configuration for a deployed contract on a network.
 */
export interface DeployedContractConfig {
  address?: string;
  salt?: string;
  deployer?: string;
}

/**
 * Fee payment contracts configuration — keyed by contract name (e.g., 'metered').
 */
export type FeePaymentContractsConfig = Record<string, DeployedContractConfig>;
