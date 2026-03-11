/**
 * Deployment data types for contract registrations.
 *
 * Deployment files define WHERE contracts are deployed (address, salt, deployer).
 * Contract configs define WHAT contracts are (artifact, constructor, sources).
 * The registry merges both at runtime.
 */

import type { DeployedContractConfig } from '../../types/network';

/**
 * All deployment data for a given network.
 * Keys are contract names mapped to their deployment data.
 */
export type NetworkDeployments = Record<string, DeployedContractConfig>;

/**
 * Placeholder values for undeployed contracts
 */
export const PLACEHOLDER_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Check if a deployment entry has valid address, salt, and deployer.
 */
export const isValidDeployment = (
  deployment: DeployedContractConfig | undefined
): boolean => {
  return (
    !!deployment &&
    !!deployment.address &&
    deployment.address !== PLACEHOLDER_ADDRESS &&
    !!deployment.salt &&
    !!deployment.deployer &&
    deployment.deployer !== PLACEHOLDER_ADDRESS
  );
};
