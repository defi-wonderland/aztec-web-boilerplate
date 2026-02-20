import tokenSandbox from '@defi-wonderland/aztec-standards/target/token_contract-Token.json';
import { DEVNET_CONFIG } from './networks/devnet';
import { SANDBOX_CONFIG } from './networks/sandbox';
import type { AztecNetwork } from './networks/constants';

export type PreconfiguredContract = {
  id: string;
  label: string;
  address: string;
  network?: AztecNetwork;
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
  },
  {
    id: 'wonderlands-token-sandbox',
    label: 'Wonderlands Token (Sandbox)',
    address: SANDBOX_CONFIG.tokenContractAddress,
    artifactJson: JSON.stringify(tokenSandbox),
    network: 'sandbox',
  },
];
