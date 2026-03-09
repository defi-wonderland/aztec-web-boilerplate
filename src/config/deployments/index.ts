export * from './types';
export { devnetDeployments } from './devnet';
export { sandboxDeployments } from './sandbox';

import { devnetDeployments } from './devnet';
import { sandboxDeployments } from './sandbox';
import type { NetworkDeployments } from './types';
import type { AztecNetwork } from '../networks/constants';

/**
 * All deployment data keyed by network name.
 * The contract registry uses this to resolve addresses at runtime.
 */
export const deployments: Record<AztecNetwork, NetworkDeployments> = {
  devnet: devnetDeployments,
  sandbox: sandboxDeployments,
};
