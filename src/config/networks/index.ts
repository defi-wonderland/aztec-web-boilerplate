export * from './types';
export * from './constants';
export * from './sandbox';
export * from './devnet';

import { SANDBOX_CONFIG } from './sandbox';
import { DEVNET_CONFIG } from './devnet';
import { NetworkConfig } from './types';

export const AVAILABLE_NETWORKS: NetworkConfig[] = [
  SANDBOX_CONFIG,
  DEVNET_CONFIG,
];

export const DEFAULT_NETWORK = SANDBOX_CONFIG;
