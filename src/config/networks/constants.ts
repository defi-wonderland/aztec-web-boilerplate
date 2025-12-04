/**
 * Centralized network configuration.
 * Single source of truth for all Aztec network URLs and chain IDs.
 */

/**
 * Default node URLs for each network type
 */
export const NETWORK_URLS = {
  sandbox: 'http://localhost:8080',
  devnet: 'https://devnet.aztec-labs.com/',
  testnet: 'https://devnet.aztec-labs.com/',
} as const;

/**
 * Available network types
 */
export type NetworkType = keyof typeof NETWORK_URLS;

/**
 * Azguard chain ID type - follows CAIP-2 format for Aztec
 */
export type AzguardChainId = `aztec:${number}`;

/**
 * Azguard chain IDs for each network
 */
export const AZGUARD_CHAIN_IDS = {
  sandbox: 'aztec:0' as AzguardChainId,
  testnet: 'aztec:11155111' as AzguardChainId,
  devnet: 'aztec:1674512022' as AzguardChainId,
  default: 'aztec:1337' as AzguardChainId,
} as const;

/**
 * All supported Azguard chains
 */
export const SUPPORTED_AZGUARD_CHAINS: AzguardChainId[] = [
  AZGUARD_CHAIN_IDS.sandbox,
  AZGUARD_CHAIN_IDS.testnet,
  AZGUARD_CHAIN_IDS.devnet,
];

/**
 * Get the default URL for a network type
 */
export const getNetworkUrl = (network: NetworkType): string => {
  return NETWORK_URLS[network];
};

/**
 * Get the Azguard chain ID for a network name
 */
export const getAzguardChainId = (networkName: string): AzguardChainId => {
  const chainMap: Record<string, AzguardChainId> = {
    sandbox: AZGUARD_CHAIN_IDS.sandbox,
    testnet: AZGUARD_CHAIN_IDS.testnet,
    devnet: AZGUARD_CHAIN_IDS.devnet,
  };
  return chainMap[networkName] ?? AZGUARD_CHAIN_IDS.default;
};
