import { NetworkConfig } from './types';
import { getSandboxDeployment, isDeploymentValid } from '../deployments';

// Type for Vite environment variables (optional overrides)
interface ViteEnv {
  VITE_AZTEC_NODE_URL?: string;
  VITE_PROVER_ENABLED?: string;
}

// Access Vite env vars for optional overrides
const env = (import.meta as unknown as { env: ViteEnv }).env;

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
 */
export const SANDBOX_CONFIG: NetworkConfig = {
  name: 'sandbox',
  displayName: 'Local Sandbox',
  description: isDeploymentValid(deployment) 
    ? 'Local development environment with deployed contracts'
    : 'Local sandbox - run "yarn deploy-contracts" to deploy',
  nodeUrl: env.VITE_AZTEC_NODE_URL || deployment.nodeUrl,
  dripperContractAddress: deployment.dripperContract.address,
  tokenContractAddress: deployment.tokenContract.address,
  deployerAddress: deployment.deployer,
  dripperDeploymentSalt: deployment.dripperContract.salt,
  tokenDeploymentSalt: deployment.tokenContract.salt,
  proverEnabled: env.VITE_PROVER_ENABLED !== undefined 
    ? env.VITE_PROVER_ENABLED !== 'false'
    : deployment.proverEnabled,
  isTestnet: false,
};
