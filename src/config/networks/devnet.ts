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
  nodeUrl: 'https://v4-devnet-2.aztec-labs.com',
  dripperContractAddress:
    '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a',
  tokenContractAddress:
    '0x15a9fec4a47541e2717c007e046837208e9383a9b66ca5bda8dfe63f785f4c47',
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
