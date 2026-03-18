import dripperSandbox from '@defi-wonderland/aztec-standards/target/dripper-Dripper.json';
import tokenSandbox from '@defi-wonderland/aztec-standards/target/token_contract-Token.json';
import { loadDeployableContracts } from '../../utils/deployableContracts';
import { getNetworkDeployments } from '../../utils/deployments';
import { CLASS_IDS } from './boilerplateContracts';
import type { DeployableContractConfig } from '../../types/deployableContract';
import type { AztecNetwork } from '../../types/network';
import type { PreconfiguredContract } from '../../types/preconfiguredContract';

const getWonderlandsTokenAddress = (
  network: AztecNetwork
): string | null => {
  const deployments = getNetworkDeployments(network);
  return deployments.token?.address ?? null;
};

const DEPLOYABLE_CONTRACTS_CONFIG: DeployableContractConfig[] = [
  {
    id: 'token-devnet',
    label: 'Token Contract',
    classId: CLASS_IDS.token,
    artifact: tokenSandbox,
    network: 'devnet',
    labelField: 'name',
  },
  {
    id: 'token-sandbox',
    label: 'Token Contract',
    classId: CLASS_IDS.token,
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

export const PRECONFIGURED_CONTRACTS: PreconfiguredContract[] = (
  [
    {
      id: 'wonderlands-token-devnet',
      label: 'Wonderlands Token (Devnet)',
      address: getWonderlandsTokenAddress('devnet'),
      classId: CLASS_IDS.token,
      artifactJson: JSON.stringify(tokenSandbox),
      network: 'devnet' as const,
    },
    {
      id: 'wonderlands-token-sandbox',
      label: 'Wonderlands Token (Sandbox)',
      address: getWonderlandsTokenAddress('sandbox'),
      classId: CLASS_IDS.token,
      artifactJson: JSON.stringify(tokenSandbox),
      network: 'sandbox' as const,
    },
  ] as const
).filter(
  (c): c is PreconfiguredContract => c.address != null
);
