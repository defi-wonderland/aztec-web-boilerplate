import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { PLACEHOLDER_ADDRESS } from "../config/deployments";
import type { WalletConnector } from "../types/walletConnector";
import { isBrowserWalletConnector } from "../types/walletConnector";
export { MinimalWallet } from './MinimalWallet';
export { queuePxeCall } from './pxeQueue';

/**
 * Checks if an object is a browser wallet placeholder (not a real contract).
 * Browser wallets can't create real contract instances, so they use placeholders.
 */
export const isBrowserWalletPlaceholder = (contract: unknown): boolean => {
  return (
    typeof contract === 'object' &&
    contract !== null &&
    '__browserWalletPlaceholder' in contract &&
    (contract as { __browserWalletPlaceholder: boolean }).__browserWalletPlaceholder === true
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

  // Check for placeholder addresses (not deployed yet)
  if (
    config.tokenContractAddress === PLACEHOLDER_ADDRESS ||
    config.dripperContractAddress === PLACEHOLDER_ADDRESS ||
    config.deployerAddress === PLACEHOLDER_ADDRESS
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
