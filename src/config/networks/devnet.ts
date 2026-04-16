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
  nodeUrl: 'https://rpc.testnet.aztec-labs.com',
  dripperContractAddress:
    '0x172684be7d86acff9c0e16b15e3f34647e5c8c26f0838a0872df7f61ddcb7070',
  tokenContractAddress:
    '0x27ea81a189e32e6b7e6602d098dac2e0ff81d27669d66ed815b2668ddb698ccd',
  deployerAddress: AztecAddress.ZERO.toString(),
  dripperDeploymentSalt: '1337',
  tokenDeploymentSalt: '1337',
  proverEnabled: true,
  isTestnet: true,
  // feePaymentContracts: {
  //   fpc: {
  //     address:
  //       '0x2a39ba8b469adc19bfc0f5c1a9d496f73b82e95fb113e020214c729ff9cd1ff4',
  //     salt: '1337',
  //     deployer: AztecAddress.ZERO.toString(),
  //   },
  // },
};
