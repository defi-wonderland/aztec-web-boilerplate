import { NetworkConfig } from './types';

/**
 * Devnet configuration for public development network.
 * 
 * Contract addresses are hardcoded for the public devnet.
 * These contracts are already deployed and available for testing.
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  displayName: 'Devnet',
  description: 'Public development network for testing with real tokens',
  nodeUrl: 'https://devnet.aztec-labs.com/',
  dripperContractAddress: '0x1dd712303e81139c9ad77f15cd3a88a87946c5f821b78350bb9238122d9fe997',
  tokenContractAddress: '0x2925b0b7212440baaace46ab05821ed589fad263fb5ff2243dd65eaaab84ab34',
  deployerAddress: '0x195f203e5dbdb9cb5afe95e382dd0c7d4b9ec3c952451cdafdd03a4230c90be5',
  dripperDeploymentSalt: '1337',
  tokenDeploymentSalt: '1337',
  proverEnabled: true,
  isTestnet: true,
};

