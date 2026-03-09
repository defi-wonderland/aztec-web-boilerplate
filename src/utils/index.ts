import { hasHexPrefix } from '@aztec/foundation/string';
import { isBrowserWalletConnector } from '../aztec-wallet/types/walletConnector';
import { PLACEHOLDER_ADDRESS } from '../config/deployments';
import {
  CHAIN_ID_TO_NETWORK,
  NETWORK_NAMES,
} from '../config/networks/constants';
import type { WalletConnector } from '../aztec-wallet/types/walletConnector';
export { cn } from './cn';
export { getNetworkDeployments } from './deployments';
export { downloadAsFile } from './file';
export {
  formatBalance,
  formatFeeJuiceBalance,
  formatRelativeTime,
  formatTime,
  formatDate,
  toBigInt,
} from './format';
export {
  formatNumberCompact,
  formatNumberFull,
  formatPercentage,
} from './formatters';
export { getMimeType } from './mime';
export { iconSize, type IconSize } from './iconSize';
export { MinimalWallet } from './MinimalWallet';
export { queuePxeCall } from './pxeQueue';
export { toTitleCase } from './string';

/** CAIP account format: "namespace:chainId:address" (e.g., "aztec:1:0x123...") */
type CaipAccountString = string;

/** Parsed CAIP account parts */
export interface CaipParts {
  namespace: string;
  chainId: string;
  address: string;
}

/**
 * Parses a CAIP account string into its components.
 * @param value - The string to parse
 * @returns Parsed parts or null if not a valid CAIP format
 */
export const parseCaipAddress = (value: string): CaipParts | null => {
  const parts = value.split(':');
  if (parts.length !== 3) return null;
  const [namespace, chainId, address] = parts;
  if (!namespace || !chainId || !address) return null;
  return { namespace, chainId, address };
};

/**
 * Type guard to check if a string is a valid CAIP account format.
 * @param value - The string to check
 */
export const isCaipAddress = (value: string): boolean => {
  return parseCaipAddress(value) !== null;
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

// ============================================================================
// ADDRESS UTILITIES
// ============================================================================

const DEFAULT_TRUNCATE_START = 6;
const DEFAULT_TRUNCATE_END = 4;

export const truncateAddress = (
  address: string | undefined,
  startChars = DEFAULT_TRUNCATE_START,
  endChars = DEFAULT_TRUNCATE_END
): string => {
  if (!address) return '';
  const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
  if (formattedAddress.length <= startChars + endChars) return formattedAddress;
  return `${formattedAddress.slice(0, startChars)}...${formattedAddress.slice(-endChars)}`;
};

export const formatAddress = (address: string | undefined): string => {
  if (!address) return '';
  return hasHexPrefix(address) ? address : `0x${address}`;
};

export const truncateCaipAddress = (
  caipAccount: CaipAccountString | undefined
): string => {
  if (!caipAccount) return '';
  const address = caipAccount.split(':')[2];
  const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
  if (formattedAddress.length <= DEFAULT_TRUNCATE_START + DEFAULT_TRUNCATE_END)
    return formattedAddress;
  return `${formattedAddress.slice(0, DEFAULT_TRUNCATE_START)}...${formattedAddress.slice(-DEFAULT_TRUNCATE_END)}`;
};

export const getCaipChainName = (caipAccount: CaipAccountString): string => {
  const chainId = caipAccount.split(':')[1];
  const network = CHAIN_ID_TO_NETWORK[chainId];
  return network ? NETWORK_NAMES[network] : `Chain ${chainId}`;
};

// ============================================================================
// CONTRACT UTILITIES
// ============================================================================

/**
 * Checks if an object is a browser wallet placeholder (not a real contract).
 * Browser wallets can't create real contract instances, so they use placeholders.
 */
export const isBrowserWalletPlaceholder = (contract: unknown): boolean => {
  return (
    typeof contract === 'object' &&
    contract !== null &&
    '__browserWalletPlaceholder' in contract &&
    (contract as { __browserWalletPlaceholder: boolean })
      .__browserWalletPlaceholder === true
  );
};

/**
 * Determines if the operations-based flow should be used for transactions.
 * This is typically for browser wallets where contracts are proxy markers.
 *
 * @param connector - The wallet connector
 * @param contracts - The contracts to check (all must be proxy contracts)
 * @returns true if operations flow should be used
 */
export const shouldUseOperationsFlow = (
  connector: WalletConnector | null,
  ...contracts: unknown[]
): boolean => {
  if (!connector) return false;

  // Must be a browser wallet that supports operations execution
  if (!isBrowserWalletConnector(connector)) return false;
  if (typeof connector.sendTransaction !== 'function') return false;

  // All provided contracts must be browser wallet placeholders
  return contracts.every(isBrowserWalletPlaceholder);
};

/**
 * Validates that a network configuration has a valid node URL.
 */
export const isValidConfig = (config: {
  nodeUrl?: string;
}): boolean => {
  if (!config.nodeUrl) return false;

  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  return urlPattern.test(config.nodeUrl);
};
