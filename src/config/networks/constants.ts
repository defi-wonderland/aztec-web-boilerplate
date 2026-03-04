/**
 * Centralized network configuration.
 * Single source of truth for all Aztec network URLs and chain IDs.
 */

/**
 * Default node URLs for each network type
 */
export const NETWORK_URLS = {
  sandbox: 'http://localhost:8080',
  devnet: 'https://v4-devnet-2.aztec-labs.com',
} as const;

/**
 * Default artifact registry URL for fetching contract artifacts
 */
export const DEFAULT_ARTIFACT_REGISTRY_URL =
  'https://devnet.aztec-registry.xyz';

/**
 * Supported Aztec network identifiers
 */
export type AztecNetwork = 'sandbox' | 'devnet';

/**
 * Default network used when none is specified
 */
export const DEFAULT_NETWORK: AztecNetwork = 'devnet';

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
  devnet: 'aztec:1647720761',
};

/**
 * Display names for each network
 */
export const NETWORK_NAMES: Record<AztecNetwork, string> = {
  sandbox: 'Local Network',
  devnet: 'Devnet',
};

/**
 * Map chain ID number to network name for lookups
 */
export const CHAIN_ID_TO_NETWORK: Record<string, AztecNetwork> = {
  '0': 'sandbox',
  '1647720761': 'devnet',
};

/**
 * All supported Aztec chains
 */
export const SUPPORTED_CHAINS: AztecChainId[] = Object.values(CHAIN_IDS);

/**
 * Get the default URL for a network type
 */
export const getNetworkUrl = (network: AztecNetwork): string => {
  return NETWORK_URLS[network];
};

/**
 * Get the chain ID for a network name
 */
export const getChainId = (network: string): AztecChainId => {
  return CHAIN_IDS[network as AztecNetwork] ?? CHAIN_IDS.devnet;
};

/**
 * Placeholder zero address for undeployed contracts or empty fields
 */
export const PLACEHOLDER_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Placeholder zero salt for undeployed contracts
 */
export const PLACEHOLDER_SALT =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
