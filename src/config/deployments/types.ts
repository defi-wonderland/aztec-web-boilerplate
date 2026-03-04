/**
 * Shared deployment configuration types.
 */

import {
  NETWORK_URLS,
  PLACEHOLDER_ADDRESS,
  PLACEHOLDER_SALT,
  type AztecNetwork,
} from '../networks/constants';

export interface ContractDeployment {
  address: string;
  salt: string;
}

export interface DeploymentConfig {
  network: AztecNetwork;
  nodeUrl: string;
  dripperContract: ContractDeployment;
  tokenContract: ContractDeployment;
  deployer: string;
  proverEnabled: boolean;
  deployedAt: string;
}

export const isDeploymentValid = (config: DeploymentConfig): boolean => {
  return (
    config.dripperContract.address !== PLACEHOLDER_ADDRESS &&
    config.tokenContract.address !== PLACEHOLDER_ADDRESS &&
    config.deployer !== PLACEHOLDER_ADDRESS
  );
};

export const DEFAULT_SANDBOX_DEPLOYMENT: DeploymentConfig = {
  network: 'sandbox',
  nodeUrl: NETWORK_URLS.sandbox,
  dripperContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  tokenContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  deployer: PLACEHOLDER_ADDRESS,
  proverEnabled: false,
  deployedAt: '',
};

export const DEFAULT_DEVNET_DEPLOYMENT: DeploymentConfig = {
  network: 'devnet',
  nodeUrl: NETWORK_URLS.devnet,
  dripperContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  tokenContract: {
    address: PLACEHOLDER_ADDRESS,
    salt: PLACEHOLDER_SALT,
  },
  deployer: PLACEHOLDER_ADDRESS,
  proverEnabled: true,
  deployedAt: '',
};
