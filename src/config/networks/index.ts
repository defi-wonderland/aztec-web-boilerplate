export * from './types';
export * from './sandbox';
export * from './testnet';

import { SANDBOX_CONFIG } from './sandbox';
import { TESTNET_CONFIG } from './testnet';
import { NetworkConfig } from './types';

export const AVAILABLE_NETWORKS: NetworkConfig[] = [
  SANDBOX_CONFIG,
  TESTNET_CONFIG,
];

export const DEFAULT_NETWORK = SANDBOX_CONFIG;
