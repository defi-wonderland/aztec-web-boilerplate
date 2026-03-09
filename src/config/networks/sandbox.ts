import { getEnv } from '../../utils/env';
import { NETWORK_URLS } from './constants';
import type { NetworkConfig } from '../../types/network';

const env = getEnv();

/**
 * Sandbox configuration for local development.
 *
 * Contract deployment data lives in src/config/deployments/sandbox.ts.
 * Run `yarn deploy-contracts` to deploy contracts and regenerate it.
 */
export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Network',
  description: 'Local development environment',
  nodeUrl: env.aztecNodeUrl || NETWORK_URLS.sandbox,
  proverEnabled: false,
  isTestnet: false,
};
