import {
  loadContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import dripperDevnetArtifactJson from './devnet/dripper-Dripper.json' with { type: 'json' };
import tokenDevnetArtifactJson from './devnet/token_contract-Token.json' with { type: 'json' };

/**
 * Artifact overrides per network. Keys are contract names, values are artifacts.
 */
export type ArtifactOverrides = Record<string, ContractArtifact>;

/**
 * Devnet artifact overrides (pinned to match public deployment)
 */
export const DEVNET_ARTIFACT_OVERRIDES: ArtifactOverrides = {
  dripper: loadContractArtifact(
    dripperDevnetArtifactJson as NoirCompiledContract
  ),
  token: loadContractArtifact(tokenDevnetArtifactJson as NoirCompiledContract),
};

/**
 * Get artifact overrides for the current network
 */
export const getArtifactOverrides = (
  networkName: string
): ArtifactOverrides | undefined => {
  if (networkName === 'devnet') {
    return DEVNET_ARTIFACT_OVERRIDES;
  }
  return undefined;
};

