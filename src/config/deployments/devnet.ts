/**
 * Devnet deployment data.
 *
 * These contracts are already deployed on the public devnet.
 * Addresses are hardcoded and stable.
 */

import type { NetworkDeployments } from './types';

/** The zero address (64 hex chars) — avoids importing the full Aztec SDK. */
const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const devnetDeployments = {
  dripper: {
    address:
      '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a',
    salt: '1337',
    deployer: ZERO_ADDRESS,
  },
  token: {
    address:
      '0x15a9fec4a47541e2717c007e046837208e9383a9b66ca5bda8dfe63f785f4c47',
    salt: '1337',
    deployer: ZERO_ADDRESS,
  },
} as const satisfies NetworkDeployments;
