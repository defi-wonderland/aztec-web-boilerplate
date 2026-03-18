import { deployments } from '../config/deployments';
import type { NetworkDeployments } from '../config/deployments/types';
import type { AztecNetwork } from '../types/network';

/**
 * Returns deployment data for a given network.
 */
export const getNetworkDeployments = (
  network: AztecNetwork
): NetworkDeployments => deployments[network];
