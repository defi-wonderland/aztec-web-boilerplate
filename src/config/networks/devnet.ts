import { NetworkConfig } from './types';

/**
 * Devnet configuration for public development network.
 *
 * Core network fields only.
 * Feature-specific contract deployments are configured in feature modules.
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network',
  nodeUrl: 'https://v4-devnet-2.aztec-labs.com',
  proverEnabled: true,
  isTestnet: true,
  feePaymentContracts: {},
};
