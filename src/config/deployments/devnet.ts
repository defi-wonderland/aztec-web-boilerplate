/**
 * Devnet deployment data.
 *
 * These contracts are already deployed on the public devnet.
 * Addresses are hardcoded and stable.
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { NetworkDeployments } from './types';

const DRIPPER_ADDRESS =
  '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a';

export const devnetDeployments: NetworkDeployments = {
  dripper: {
    address: DRIPPER_ADDRESS,
    salt: '1337',
    deployer: AztecAddress.ZERO.toString(),
  },
  token: {
    address:
      '0x15a9fec4a47541e2717c007e046837208e9383a9b66ca5bda8dfe63f785f4c47',
    salt: '1337',
    deployer: AztecAddress.ZERO.toString(),
  },
};
