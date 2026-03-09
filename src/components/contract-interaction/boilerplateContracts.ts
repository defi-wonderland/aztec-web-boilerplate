/**
 * Boilerplate demo contracts (Dripper + Token).
 *
 * These are the contracts shipped with the Aztec Web Boilerplate.
 * When forking this project, you can remove this file and define
 * your own contracts directly in contracts.ts.
 */
import { DripperContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { ARTIFACT_REGISTRY_URL } from '../../config/networks/constants';
import { createContractConfig } from '../../contract-registry';
import type { ArtifactSourceConfig } from '../../types/artifactSource';

// ---------------------------------------------------------------------------
// Artifact source chains
// ---------------------------------------------------------------------------

const dripperArtifactSources: ArtifactSourceConfig[] = [
  { registry: ARTIFACT_REGISTRY_URL },
  { local: DripperContract.artifact },
];

const tokenArtifactSources: ArtifactSourceConfig[] = [
  { registry: ARTIFACT_REGISTRY_URL },
  { local: TokenContract.artifact },
];

/**
 * Known contract class IDs.
 * Used for registry lookups and preconfigured contract references.
 */
export const CLASS_IDS = {
  dripper: '0x1dffc5e2b304ff01d1c589e19b2c953575f022a17f1acf4e01614527c24093db',
  token: '0x25a9e07ed00603660d81a3db8836a766dd4f0f259e764b682fad713cdc9aa99d',
} as const;

// ---------------------------------------------------------------------------
// Contract definitions
// ---------------------------------------------------------------------------

export const boilerplateContracts = createContractConfig({
  /**
   * Dripper contract - Mints tokens to users
   */
  dripper: {
    contract: DripperContract,
    constructorArtifact: 'constructor',
    constructorArgs: [],
    lazyRegister: false,
    artifactSources: dripperArtifactSources,
    classId: CLASS_IDS.dripper,
  },

  /**
   * Token contract - WETH
   */
  token: {
    contract: TokenContract,
    constructorArtifact: 'constructor_with_minter',
    constructorArgs: (deployments) => [
      'WETH',
      'WETH',
      18,
      AztecAddress.fromString(deployments.dripper.address),
      AztecAddress.ZERO,
    ],
    lazyRegister: true,
    artifactSources: tokenArtifactSources,
    classId: CLASS_IDS.token,
  },
});
