import {
  loadContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
// Devnet artifacts
import dripperDevnetJson from '../artifacts/devnet/dripper-Dripper.json' with { type: 'json' };
import tokenDevnetJson from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };
// Sandbox artifacts
import dripperSandboxJson from '../artifacts/sandbox/dripper-Dripper.json' with { type: 'json' };
import tokenSandboxJson from '../artifacts/sandbox/token_contract-Token.json' with { type: 'json' };

/**
 * Network-specific artifact overrides.
 *
 * Some networks require pinned artifact versions that match the deployed contracts.
 * Add your contract artifacts here when connecting to networks with pre-deployed contracts.
 *
 * Keys are contract names (matching those in contracts.ts), values are artifacts.
 */
export type NetworkArtifactOverrides = Record<string, ContractArtifact>;

export const DEVNET_ARTIFACTS: NetworkArtifactOverrides = {
  dripper: loadContractArtifact(dripperDevnetJson as NoirCompiledContract),
  token: loadContractArtifact(tokenDevnetJson as NoirCompiledContract),
};

export const SANDBOX_ARTIFACTS: NetworkArtifactOverrides = {
  dripper: loadContractArtifact(dripperSandboxJson as NoirCompiledContract),
  token: loadContractArtifact(tokenSandboxJson as NoirCompiledContract),
};

export const getNetworkArtifacts = (
  networkName: string
): NetworkArtifactOverrides | undefined => {
  switch (networkName) {
    case 'devnet':
      return DEVNET_ARTIFACTS;
    case 'sandbox':
      return SANDBOX_ARTIFACTS;
    default:
      return undefined;
  }
};
