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
import { DEFAULT_ARTIFACT_REGISTRY_URL } from './networks/constants';
import type { ArtifactSourceConfig } from '../types/artifactSource';

// ---------------------------------------------------------------------------
// Boilerplate-specific constants
// ---------------------------------------------------------------------------

const registryUrl =
  import.meta.env.VITE_ARTIFACT_REGISTRY_URL ?? DEFAULT_ARTIFACT_REGISTRY_URL;

const DEFAULT_EXTERNAL_TGZ_URL =
  'https://github.com/defi-wonderland/aztec-standards/releases/download/prerelease-69dc5c4/defi-wonderland-aztec-standards-4.0.0-devnet.2-patch.1-prerelease.69dc5c4.tgz';

/** Rewrite `https://github.com/` URLs to the CORS proxy path. */
function toProxiedGithubUrl(url: string): string {
  return url.replace(/^https:\/\/github\.com\//, '/github-releases/');
}

const externalTgzUrl = toProxiedGithubUrl(
  import.meta.env.VITE_EXTERNAL_TGZ_URL ?? DEFAULT_EXTERNAL_TGZ_URL
);

const CLASS_IDS = {
  dripper: '0x1dffc5e2b304ff01d1c589e19b2c953575f022a17f1acf4e01614527c24093db',
  token: '0x25a9e07ed00603660d81a3db8836a766dd4f0f259e764b682fad713cdc9aa99d',
} as const;

// ---------------------------------------------------------------------------
// Artifact source chains
// ---------------------------------------------------------------------------

function dripperArtifactSources(): ArtifactSourceConfig[] {
  return [
    { registry: registryUrl },
    { external: externalTgzUrl },
    { local: DripperContract.artifact },
  ];
}

function tokenArtifactSources(): ArtifactSourceConfig[] {
  return [
    { registry: registryUrl },
    { external: externalTgzUrl },
    { local: TokenContract.artifact },
  ];
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
    classId: () => CLASS_IDS.dripper,
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
        AztecAddress.ZERO,
      ],
      constructorArtifact: 'constructor_with_minter',
    }),
    lazyRegister: true,
    artifactSources: tokenArtifactSources,
    classId: () => CLASS_IDS.token,
  },
});
