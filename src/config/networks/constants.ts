/**
 * Centralized network configuration.
 * Single source of truth for all Aztec network URLs and chain IDs.
 */

/**
 * Default node URLs for each network type
 */
export const NETWORK_URLS = {
  sandbox: 'http://localhost:8080',
  devnet: 'https://next.devnet.aztec-labs.com/',
} as const;

/**
 * Available network types
 */
export type NetworkType = keyof typeof NETWORK_URLS;

/**
 * Supported Aztec network identifiers
 */
export type AztecNetwork = 'sandbox' | 'devnet';

/**
 * Aztec chain ID type - follows CAIP-2 format
 */
export type AztecChainId = `aztec:${number}`;

/**
 * Chain IDs for each network (CAIP-2 format)
 * Note: devnet chain ID must match browser wallet configuration
 */
export const CHAIN_IDS: Record<AztecNetwork, AztecChainId> = {
  sandbox: 'aztec:0',
  devnet: 'aztec:1654394782',
};

/**
 * Display names for each network
 */
export const NETWORK_NAMES: Record<AztecNetwork, string> = {
  sandbox: 'Sandbox',
  devnet: 'Devnet',
};

/**
 * Map chain ID number to network name for lookups
 */
export const CHAIN_ID_TO_NETWORK: Record<string, AztecNetwork> = {
  '0': 'sandbox',
  '1654394782': 'devnet',
};

/**
 * All supported Aztec chains
 */
export const SUPPORTED_CHAINS: AztecChainId[] = Object.values(CHAIN_IDS);

/**
 * Get the default URL for a network type
 */
export const getNetworkUrl = (network: NetworkType): string => {
  return NETWORK_URLS[network];
};

/**
 * Get the chain ID for a network name
 */
export const getChainId = (network: string): AztecChainId => {
  return CHAIN_IDS[network as AztecNetwork] ?? CHAIN_IDS.devnet;
};
