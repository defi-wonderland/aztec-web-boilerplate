export * from './types';
export * from './constants';
export * from './sandbox';
export * from './devnet';
export * from './testnet';

import { SANDBOX_CONFIG } from './sandbox';
import { DEVNET_CONFIG } from './devnet';
import { TESTNET_CONFIG } from './testnet';
import { NetworkConfig } from './types';

export const AVAILABLE_NETWORKS: NetworkConfig[] = [
  SANDBOX_CONFIG,
  DEVNET_CONFIG,
  TESTNET_CONFIG,
];

export const DEFAULT_NETWORK = SANDBOX_CONFIG;
