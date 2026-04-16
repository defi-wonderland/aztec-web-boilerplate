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
import { Fr } from '@aztec/aztec.js/fields';
import { createContractConfig, getDeployerAddress } from '../contract-registry';
import type { ArtifactSourceConfig } from '../types/artifactSource';

// ---------------------------------------------------------------------------
// Artifact source chains
// ---------------------------------------------------------------------------

function dripperArtifactSources(): ArtifactSourceConfig[] {
  return [{ local: DripperContract.artifact }];
}

function tokenArtifactSources(): ArtifactSourceConfig[] {
  return [{ local: TokenContract.artifact }];
}

// ---------------------------------------------------------------------------
// Contract definitions
// ---------------------------------------------------------------------------

export const boilerplateContracts = createContractConfig({
  /**
   * Dripper contract - Mints tokens to users
   */
  dripper: {
    contract: DripperContract,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.dripperDeploymentSalt),
      deployer: getDeployerAddress(config),
      constructorArgs: [],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: false,
    artifactSources: dripperArtifactSources,
  },

  /**
   * Token contract - WETH
   */
  token: {
    contract: TokenContract,
    address: (config) => config.tokenContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.tokenDeploymentSalt),
      deployer: getDeployerAddress(config),
      constructorArgs: [
        'WETH',
        'WETH',
        18,
        AztecAddress.fromString(config.dripperContractAddress),
      ],
      constructorArtifact: 'constructor_with_minter',
    }),
    lazyRegister: true,
    artifactSources: tokenArtifactSources,
  },
});
