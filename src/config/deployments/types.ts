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
