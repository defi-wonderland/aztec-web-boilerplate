import { NetworkConfig } from './types';

export const TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  displayName: 'Testnet',
  description: 'Public test network for testing with real tokens',
  deployerAddress: '0x2d15e363ff97f590e6e373e0753e3869dbcf28429dee13f455069c09a6455c79',
  dripperContractAddress: '0x20232858640b59fd7c40a6a6bb4c04a261bed82934eb151b4e1dab8793ee42f5',
  tokenContractAddress: '0x166c88ac7708da5c211e5755326c1ee1c9cbebd5ca9ed7f54d515f7407c37d5a',
  dripperDeploymentSalt: '0x0000000000000000000000000000000000000000000000000000000000000539',
  tokenDeploymentSalt: '0x0000000000000000000000000000000000000000000000000000000000000539',
  nodeUrl: 'https://aztec-alpha-testnet-fullnode.zkv.xyz/',
  proverEnabled: true,
  isTestnet: true,
};

// Bridge configuration for cross-chain transfers
export const BRIDGE_CONFIG = {
  aztecWETH: '0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb',
  baseSepoliaWETH: '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc',
  gateway: '0x0Bf4eD5a115e6Ad789A88c21e9B75821Cc7B2e6f',
  baseSepoliaChainId: 84532,
  aztecDomain: 999999,
} as const;
