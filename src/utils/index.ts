import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { PLACEHOLDER_ADDRESS } from "../config/deployments";
import type { WalletConnector, ConnectorCapabilities } from "../types/walletConnector";
export { MinimalWallet } from './MinimalWallet';
export { queuePxeCall } from './pxeQueue';

// ============================================================================
// WALLET TYPE DETECTION UTILITIES
// ============================================================================

export const isProxyContract = (contract: unknown): boolean => {
  return (
    typeof contract === 'object' &&
    contract !== null &&
    '__azguardProxy' in contract &&
    (contract as { __azguardProxy: boolean }).__azguardProxy === true
  );
};

/**
 * @deprecated Use isProxyContract instead for wallet-agnostic code
 */
export const isAzguardProxy = isProxyContract;

/**
 * Checks if the wallet is an external/injected wallet (vs embedded).
 * External wallets don't have local PXE access and use operations-based execution.
 * 
 * @param connector - The wallet connector to check
 * @returns true if the wallet is external (injected), false if embedded or null
 */
export const isExternalWallet = (connector: WalletConnector | null): boolean => {
  if (!connector) return false;
  
  // External wallets typically:
  // 1. Don't have local PXE access (hasPXE = false)
  // 2. Can execute operations through their own infrastructure
  return !connector.capabilities.hasPXE && connector.capabilities.canExecuteOperations;
};

/**
 * Checks if the wallet is an embedded wallet with local PXE access.
 * 
 * @param connector - The wallet connector to check
 * @returns true if the wallet is embedded with local PXE
 */
export const isEmbeddedWallet = (connector: WalletConnector | null): boolean => {
  if (!connector) return false;
  return connector.capabilities.hasPXE;
};

/**
 * Determines if the operations-based flow should be used for transactions.
 * This is typically for external wallets where contracts are proxy markers.
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
  
  // Must support operations execution
  const supportsOperations = 
    connector.capabilities.canExecuteOperations &&
    typeof connector.sendTransaction === 'function';
  
  if (!supportsOperations) return false;
  
  // All provided contracts must be proxy contracts
  return contracts.every(isProxyContract);
};

/**
 * Gets wallet capabilities summary for debugging/logging.
 * 
 * @param connector - The wallet connector
 * @returns Human-readable summary of wallet capabilities
 */
export const getWalletCapabilitiesSummary = (
  connector: WalletConnector | null
): { type: 'embedded' | 'external' | 'unknown'; capabilities: Partial<ConnectorCapabilities> } => {
  if (!connector) {
    return { type: 'unknown', capabilities: {} };
  }
  
  const type = isEmbeddedWallet(connector) 
    ? 'embedded' 
    : isExternalWallet(connector) 
      ? 'external' 
      : 'unknown';
  
  return {
    type,
    capabilities: connector.capabilities,
  };
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
