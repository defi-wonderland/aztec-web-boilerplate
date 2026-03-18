export * from './constants';
export * from './sandbox';
export { DEVNET_CONFIG } from './devnet';

import { DEVNET_CONFIG } from './devnet';
import { SANDBOX_CONFIG } from './sandbox';
import type { NetworkConfig } from '../../types/network';

export const AVAILABLE_NETWORKS: NetworkConfig[] = [
  SANDBOX_CONFIG,
  DEVNET_CONFIG,
];
