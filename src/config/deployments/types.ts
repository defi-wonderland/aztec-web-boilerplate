/**
 * Deployment configuration types for Aztec contracts
 */

/**
 * Contract deployment information
 */
export interface ContractDeployment {
  address: string;
  salt: string;
}

/**
 * Full deployment configuration for a network
 */
export interface DeploymentConfig {
  network: 'sandbox' | 'testnet';
  nodeUrl: string;
  dripperContract: ContractDeployment;
  tokenContract: ContractDeployment;
  deployer: string;
  proverEnabled: boolean;
  deployedAt: string;
}

/**
 * Placeholder values for undeployed contracts
 */
export const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const PLACEHOLDER_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Check if a deployment config has valid (non-placeholder) contract addresses
 */
export const isDeploymentValid = (config: DeploymentConfig): boolean => {
  return (
    config.dripperContract.address !== PLACEHOLDER_ADDRESS &&
    config.tokenContract.address !== PLACEHOLDER_ADDRESS &&
    config.deployer !== PLACEHOLDER_ADDRESS
  );
};

/**
 * Default sandbox deployment config (placeholder until contracts are deployed)
 */
export const DEFAULT_SANDBOX_DEPLOYMENT: DeploymentConfig = {
  network: 'sandbox',
  nodeUrl: 'http://localhost:8080',
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

/**
 * Default testnet deployment config (placeholder until contracts are deployed)
 */
export const DEFAULT_TESTNET_DEPLOYMENT: DeploymentConfig = {
  network: 'testnet',
  nodeUrl: 'https://aztec-alpha-testnet-fullnode.zkv.xyz/',
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

