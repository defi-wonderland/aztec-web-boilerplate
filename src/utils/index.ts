import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { PLACEHOLDER_ADDRESS } from "../config/deployments";
export { MinimalWallet } from './MinimalWallet';

/**
 * Type guard to check if a contract is an Azguard proxy marker.
 * Azguard proxies don't have real contract methods - all calls go through Azguard's execute API.
 */
export const isAzguardProxy = (contract: unknown): boolean => {
  return (
    typeof contract === 'object' &&
    contract !== null &&
    '__azguardProxy' in contract &&
    (contract as { __azguardProxy: boolean }).__azguardProxy === true
  );
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
