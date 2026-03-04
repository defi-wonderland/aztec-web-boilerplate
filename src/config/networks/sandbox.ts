import { getEnv } from '../../utils/env';
import { NETWORK_URLS } from './constants';
import { NetworkConfig } from './types';

const env = getEnv();

/**
 * Sandbox configuration for local development.
 *
 * Feature-specific contract deployments are configured in feature modules.
 */
export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Network',
  description: 'Local development environment',
  nodeUrl: env.aztecNodeUrl || NETWORK_URLS.sandbox,
  proverEnabled: false,
  isTestnet: false,
  feePaymentContracts: {},
};
