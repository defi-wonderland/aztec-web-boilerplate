import { AztecAddress } from '@aztec/stdlib/aztec-address';
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
  nodeUrl: 'https://v4-devnet-1.aztec-labs.com',
  dripperContractAddress:
    '0x294f2f4d12fc8308fcde6df4025a9e83004928e58b4082e49b93b4bb69f6b0d8',
  tokenContractAddress:
    '0x24bf78296b515bab819d4e6bc39ef2dad7291699342d674f6ee155cae964fe55',
  deployerAddress: AztecAddress.ZERO.toString(),
  dripperDeploymentSalt: '1337',
  tokenDeploymentSalt: '1337',
  proverEnabled: true,
  isTestnet: true,
  // feePaymentContracts: {
  //   metered: {
  //     address:
  //       '0x2a39ba8b469adc19bfc0f5c1a9d496f73b82e95fb113e020214c729ff9cd1ff4',
  //     salt: '1337',
  //     deployer: AztecAddress.ZERO.toString(),
  //   },
  // },
};
