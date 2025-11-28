export * from './types';

import sandboxDeployment from './sandbox.json';
import testnetDeployment from './testnet.json';
import {
  DeploymentConfig,
  DEFAULT_SANDBOX_DEPLOYMENT,
  DEFAULT_TESTNET_DEPLOYMENT,
} from './types';

/**
 * Load sandbox deployment config from JSON file
 * Falls back to default placeholder if file is invalid
 */
export const getSandboxDeployment = (): DeploymentConfig => {
  try {
    return sandboxDeployment as DeploymentConfig;
  } catch {
    return DEFAULT_SANDBOX_DEPLOYMENT;
  }
};

/**
 * Load testnet deployment config from JSON file
 * Falls back to default placeholder if file is invalid
 */
export const getTestnetDeployment = (): DeploymentConfig => {
  try {
    return testnetDeployment as DeploymentConfig;
  } catch {
    return DEFAULT_TESTNET_DEPLOYMENT;
  }
};



