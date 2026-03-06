import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import tokenSandbox from '@defi-wonderland/aztec-standards/target/token_contract-Token.json';
import { ARTIFACT_REGISTRY_URL } from './networks/constants';
import { DEVNET_CONFIG } from './networks/devnet';
import { SANDBOX_CONFIG } from './networks/sandbox';
import type { AztecNetwork } from './networks/constants';
import type { ArtifactSourceConfig } from '../types/artifactSource';

export type PreconfiguredContract = {
  id: string;
  label: string;
  address: string;
  network?: AztecNetwork;
  artifactSources?: ArtifactSourceConfig[];
} & (
  | { artifactJson: string; classId?: never }
  | { artifactJson?: never; classId: string }
);

export const PRECONFIGURED_CONTRACTS: PreconfiguredContract[] = [
  {
    id: 'wonderlands-token-devnet',
    label: 'Wonderlands Token (Devnet)',
    address: DEVNET_CONFIG.tokenContractAddress,
    classId:
      '0x1a89e73869a0969d6a14a8eb2ad8c981820302ff64c55b1225fbe29e4bfa99aa',
    network: 'devnet',
    artifactSources: [
      { registry: ARTIFACT_REGISTRY_URL },
      { local: TokenContract.artifact },
    ],
  },
  {
    id: 'wonderlands-token-sandbox',
    label: 'Wonderlands Token (Sandbox)',
    address: SANDBOX_CONFIG.tokenContractAddress,
    artifactJson: JSON.stringify(tokenSandbox),
    network: 'sandbox',
  },
];
