export * from './types';

import devnetDeployment from './devnet.json';
import sandboxDeployment from './sandbox.json';
import {
  DeploymentConfig,
  DEFAULT_SANDBOX_DEPLOYMENT,
  DEFAULT_DEVNET_DEPLOYMENT,
} from './types';

export const getSandboxDeployment = (): DeploymentConfig => {
  try {
    return sandboxDeployment as DeploymentConfig;
  } catch {
    return DEFAULT_SANDBOX_DEPLOYMENT;
  }
};

export const getDevnetDeployment = (): DeploymentConfig => {
  try {
    return devnetDeployment as DeploymentConfig;
  } catch {
    return DEFAULT_DEVNET_DEPLOYMENT;
  }
};
