import { NETWORK_URLS } from './constants';
import type { NetworkConfig } from '../../types/network';

/**
 * Devnet configuration for public development network.
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network for testing with real tokens',
  nodeUrl: NETWORK_URLS.devnet,
  proverEnabled: true,
  isTestnet: true,
};
