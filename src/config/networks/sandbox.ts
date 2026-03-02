import { getEnv } from '../../utils/env';
import { getSandboxDeployment, isDeploymentValid } from '../deployments';
import { NetworkConfig } from './types';

const env = getEnv();

/**
 * Load sandbox deployment from JSON config file.
 * Environment variables can override nodeUrl and proverEnabled.
 */
const deployment = getSandboxDeployment();

/**
 * Sandbox configuration for local development.
 *
 * Contract addresses are loaded from src/config/deployments/sandbox.json
 * Run `yarn deploy-contracts` to deploy contracts and generate this config.
 *
 * Uses local artifacts for offline development (no external registry).
 */
export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Network',
  description: isDeploymentValid(deployment)
    ? 'Local development environment with deployed contracts'
    : 'Local network - run "yarn deploy-contracts" to deploy',
  nodeUrl: env.aztecNodeUrl || deployment.nodeUrl,
  dripperContractAddress: deployment.dripperContract.address,
  tokenContractAddress: deployment.tokenContract.address,
  deployerAddress: deployment.deployer,
  dripperDeploymentSalt: deployment.dripperContract.salt,
  tokenDeploymentSalt: deployment.tokenContract.salt,
  proverEnabled: deployment.proverEnabled,
  isTestnet: false,
};
