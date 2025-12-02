/**
 * Centralized network URL configuration.
 * Single source of truth for all Aztec network URLs.
 */

/**
 * Default node URLs for each network type
 */
export const NETWORK_URLS = {
  sandbox: 'http://localhost:8080',
  testnet: 'https://devnet.aztec-labs.com/',
} as const;

/**
 * Available network types
 */
export type NetworkType = keyof typeof NETWORK_URLS;

/**
 * Get the default URL for a network type
 */
export const getNetworkUrl = (network: NetworkType): string => {
  return NETWORK_URLS[network];
};
