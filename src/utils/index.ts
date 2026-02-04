import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { hasHexPrefix } from '@aztec/foundation/string';
import { PLACEHOLDER_ADDRESS } from '../config/deployments';
import {
  CHAIN_ID_TO_NETWORK,
  NETWORK_NAMES,
} from '../config/networks/constants';
import { isBrowserWalletConnector } from '../types/walletConnector';
import type { WalletConnector } from '../types/walletConnector';
export { cn } from './cn';
export { formatBalance, formatFeeJuiceBalance } from './format';
export { iconSize, type IconSize } from './iconSize';
export { MinimalWallet } from './MinimalWallet';
export { queuePxeCall } from './pxeQueue';
export { toTitleCase } from './string';
export {
  waitForBrowserWalletReceipt,
  type WaitForReceiptOptions,
  type WaitForReceiptResult,
} from './txReceipt';

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
  if (formattedAddress.length <= TRUNCATE_START + TRUNCATE_END)
    return formattedAddress;
  return `${formattedAddress.slice(0, TRUNCATE_START)}...${formattedAddress.slice(-TRUNCATE_END)}`;
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
 * Validates that a network configuration has valid contract addresses.
 * Returns false if addresses are placeholders or invalid.
 */
export const isValidConfig = (config: {
  nodeUrl?: string;
  tokenContractAddress?: string;
  dripperContractAddress?: string;
  deployerAddress?: string;
  dripperDeploymentSalt?: string;
  tokenDeploymentSalt?: string;
}): boolean => {
  // Check required fields exist
  if (
    !config.nodeUrl ||
    !config.tokenContractAddress ||
    !config.dripperContractAddress ||
    !config.deployerAddress ||
    !config.dripperDeploymentSalt ||
    !config.tokenDeploymentSalt
  ) {
    return false;
  }

  // Check for placeholder contract addresses (not deployed yet)
  // Note: deployerAddress can be zero for public networks where deployer is unknown
  if (
    config.tokenContractAddress === PLACEHOLDER_ADDRESS ||
    config.dripperContractAddress === PLACEHOLDER_ADDRESS
  ) {
    return false;
  }

  // Validate Aztec addresses
  try {
    AztecAddress.fromString(config.tokenContractAddress);
    AztecAddress.fromString(config.dripperContractAddress);
  } catch {
    return false;
  }

  // Validate deployment salts
  try {
    Fr.fromString(config.dripperDeploymentSalt);
    Fr.fromString(config.tokenDeploymentSalt);
  } catch {
    return false;
  }

  // Validate node URL format
  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  if (!urlPattern.test(config.nodeUrl)) {
    return false;
  }

  return true;
};
