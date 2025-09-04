import { NetworkConfig } from './types';

// TODO: Fill in actual testnet addresses when available
export const TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  displayName: 'Testnet',
  description: 'Public test network for testing with real tokens',
  nodeUrl: '',
  dripperContractAddress: '',
  tokenContractAddress: '',
  deployerAddress: '',
  dripperDeploymentSalt: '',
  tokenDeploymentSalt: '',
  proverEnabled: true,
  isTestnet: true,
};
