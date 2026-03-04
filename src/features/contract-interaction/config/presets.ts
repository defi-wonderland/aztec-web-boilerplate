import dripperSandbox from '@defi-wonderland/aztec-standards/target/dripper-Dripper.json';
import tokenSandbox from '@defi-wonderland/aztec-standards/target/token_contract-Token.json';
import { getSandboxDeployment } from '../../../config/deployments';
import { loadDeployableContracts } from '../../../utils/deployableContracts';
import type { DeployableContractConfig } from '../../../types/deployableContract';
import type { PreconfiguredContract } from '../../../types/preconfiguredContract';

const WONDERLANDS_TOKEN_CLASS_ID =
  '0x25a9e07ed00603660d81a3db8836a766dd4f0f259e764b682fad713cdc9aa99d';

const DEVNET_WONDERLANDS_TOKEN_ADDRESS =
  '0x15a9fec4a47541e2717c007e046837208e9383a9b66ca5bda8dfe63f785f4c47';

const getWonderlandsTokenAddress = (network: 'devnet' | 'sandbox'): string => {
  if (network === 'sandbox') {
    return getSandboxDeployment().tokenContract.address;
  }

  return DEVNET_WONDERLANDS_TOKEN_ADDRESS;
};

const DEPLOYABLE_CONTRACTS_CONFIG: DeployableContractConfig[] = [
  {
    id: 'token-devnet',
    label: 'Token Contract',
    classId: WONDERLANDS_TOKEN_CLASS_ID,
    artifact: tokenSandbox,
    network: 'devnet',
    labelField: 'name',
  },
  {
    id: 'token-sandbox',
    label: 'Token Contract',
    classId: WONDERLANDS_TOKEN_CLASS_ID,
    artifact: tokenSandbox,
    network: 'sandbox',
    labelField: 'name',
  },
  {
    id: 'dripper-sandbox',
    label: 'Dripper',
    artifact: dripperSandbox,
    network: 'sandbox',
  },
];

export const DEPLOYABLE_CONTRACTS = loadDeployableContracts(
  DEPLOYABLE_CONTRACTS_CONFIG
);

export const PRECONFIGURED_CONTRACTS: PreconfiguredContract[] = [
  {
    id: 'wonderlands-token-devnet',
    label: 'Wonderlands Token (Devnet)',
    address: getWonderlandsTokenAddress('devnet'),
    classId: WONDERLANDS_TOKEN_CLASS_ID,
    artifactJson: JSON.stringify(tokenSandbox),
    network: 'devnet',
  },
  {
    id: 'wonderlands-token-sandbox',
    label: 'Wonderlands Token (Sandbox)',
    address: getWonderlandsTokenAddress('sandbox'),
    classId: WONDERLANDS_TOKEN_CLASS_ID,
    artifactJson: JSON.stringify(tokenSandbox),
    network: 'sandbox',
  },
];
