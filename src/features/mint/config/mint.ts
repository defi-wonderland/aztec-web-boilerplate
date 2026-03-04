import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { getSandboxDeployment } from '../../../config/deployments';
import type { AztecNetwork } from '../../../config/networks/constants';

/**
 * Mint example class IDs.
 * Kept local to the feature so the feature can be removed cleanly.
 */
export const MINT_CLASS_IDS = {
  dripper: '0x1dffc5e2b304ff01d1c589e19b2c953575f022a17f1acf4e01614527c24093db',
  token: '0x25a9e07ed00603660d81a3db8836a766dd4f0f259e764b682fad713cdc9aa99d',
} as const;

export interface MintFeatureDeployment {
  deployer: string;
  dripperContract: {
    address: string;
    salt: string;
  };
  tokenContract: {
    address: string;
    salt: string;
  };
}

const DEVNET_DEPLOYMENT: MintFeatureDeployment = {
  deployer: AztecAddress.ZERO.toString(),
  dripperContract: {
    address:
      '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a',
    salt: '1337',
  },
  tokenContract: {
    address:
      '0x15a9fec4a47541e2717c007e046837208e9383a9b66ca5bda8dfe63f785f4c47',
    salt: '1337',
  },
};

const getSandboxMintDeployment = (): MintFeatureDeployment => {
  const deployment = getSandboxDeployment();

  return {
    deployer: deployment.deployer,
    dripperContract: {
      address: deployment.dripperContract.address,
      salt: deployment.dripperContract.salt,
    },
    tokenContract: {
      address: deployment.tokenContract.address,
      salt: deployment.tokenContract.salt,
    },
  };
};

export const getMintFeatureDeployment = (
  network: AztecNetwork
): MintFeatureDeployment => {
  if (network === 'sandbox') {
    return getSandboxMintDeployment();
  }

  return DEVNET_DEPLOYMENT;
};
