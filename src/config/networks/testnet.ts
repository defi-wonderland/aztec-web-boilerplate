import { NetworkConfig } from './types';
import { getTestnetDeployment, isDeploymentValid } from '../deployments';

/**
 * Load testnet deployment from JSON config file.
 */
const deployment = getTestnetDeployment();

/**
 * Testnet configuration for public test network.
 * 
 * Contract addresses are loaded from src/config/deployments/testnet.json
 * Run `yarn deploy-contracts:testnet` to deploy contracts and generate this config.
 */
export const TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  displayName: 'Testnet',
  description: isDeploymentValid(deployment)
    ? 'Public test network with deployed contracts'
    : 'Testnet - run "yarn deploy-contracts:testnet" to deploy',
  nodeUrl: deployment.nodeUrl,
  dripperContractAddress: deployment.dripperContract.address,
  tokenContractAddress: deployment.tokenContract.address,
  deployerAddress: deployment.deployer,
  dripperDeploymentSalt: deployment.dripperContract.salt,
  tokenDeploymentSalt: deployment.tokenContract.salt,
  proverEnabled: deployment.proverEnabled,
  isTestnet: true,
};
