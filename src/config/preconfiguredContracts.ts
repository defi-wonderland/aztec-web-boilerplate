import tokenDevnet from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };
import tokenSandbox from '../artifacts/sandbox/token_contract-Token.json' with { type: 'json' };
import type { AztecNetwork } from './networks/constants';

export type PreconfiguredContract = {
  id: string;
  label: string;
  address: string;
  artifactJson: string;
  network?: AztecNetwork;
};

export const PRECONFIGURED_CONTRACTS: PreconfiguredContract[] = [
  {
    id: 'wonderlands-token-devnet',
    label: 'Wonderlands Token (Devnet)',
    address:
      '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639',
    artifactJson: JSON.stringify(tokenDevnet),
    network: 'devnet',
  },
  {
    id: 'wonderlands-token-sandbox',
    label: 'Wonderlands Token (Sandbox)',
    address:
      '0x1d64b9cf07d536e6b218c14256c4965abb568f02648d5ce1da6d58caea6c3639',
    artifactJson: JSON.stringify(tokenSandbox),
    network: 'sandbox',
  },
];
