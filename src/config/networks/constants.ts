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
 * Default external tgz URL for downloading pre-built contract artifacts.
 * Used as a fallback when the artifact registry is unavailable.
 */
export const DEFAULT_EXTERNAL_TGZ_URL =
  'https://github.com/defi-wonderland/aztec-standards/releases/download/prerelease-69dc5c4/defi-wonderland-aztec-standards-4.0.0-devnet.2-patch.1-prerelease.69dc5c4.tgz';

/** Rewrite `https://github.com/` URLs to the CORS proxy path. */
export function toProxiedGithubUrl(url: string): string {
  return url.replace(/^https:\/\/github\.com\//, '/github-releases/');
}

/** Resolved registry URL (env override or default). */
export const ARTIFACT_REGISTRY_URL: string =
  import.meta?.env?.VITE_ARTIFACT_REGISTRY_URL ?? DEFAULT_ARTIFACT_REGISTRY_URL;

/** Resolved external tgz URL (env override → CORS proxy). */
export const EXTERNAL_TGZ_URL: string = toProxiedGithubUrl(
  import.meta?.env?.VITE_EXTERNAL_TGZ_URL ?? DEFAULT_EXTERNAL_TGZ_URL
);

/**
 * Available network types
 */
export type NetworkType = keyof typeof NETWORK_URLS;

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
export const getNetworkUrl = (network: NetworkType): string => {
  return NETWORK_URLS[network];
};

/**
 * Get the chain ID for a network name
 */
export const getChainId = (network: string): AztecChainId => {
  return CHAIN_IDS[network as AztecNetwork] ?? CHAIN_IDS.devnet;
};
