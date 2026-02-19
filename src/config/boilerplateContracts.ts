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
import type { NetworkConfig } from './networks/types';

// ---------------------------------------------------------------------------
// Boilerplate-specific constants
// ---------------------------------------------------------------------------

const registryUrl =
  import.meta.env.VITE_ARTIFACT_REGISTRY_URL ?? DEFAULT_ARTIFACT_REGISTRY_URL;

const DEFAULT_EXTERNAL_TGZ_URL =
  'https://github.com/defi-wonderland/aztec-standards/releases/download/prerelease-81f5ec2/defi-wonderland-aztec-standards-4.0.0-devnet.1-patch.0-prerelease.81f5ec2.tgz';

/** Rewrite `https://github.com/` URLs to the CORS proxy path. */
function toProxiedGithubUrl(url: string): string {
  return url.replace(/^https:\/\/github\.com\//, '/github-releases/');
}

const externalTgzUrl = toProxiedGithubUrl(
  import.meta.env.VITE_EXTERNAL_TGZ_URL ?? DEFAULT_EXTERNAL_TGZ_URL
);

const CLASS_IDS = {
  dripper: '0x2fe44c2f36062274537d51195e541a011125c920051092abbe2363b3ef09a948',
  token: '0x1eaabff5ad01676aa440f64f9e2909bb04f5c45b4fe46264daf482ad3992b551',
} as const;

// ---------------------------------------------------------------------------
// Artifact source chains
// ---------------------------------------------------------------------------

function dripperArtifactSources(config: NetworkConfig): ArtifactSourceConfig[] {
  if (config.name === 'devnet') {
    return [
      { registry: registryUrl },
      { external: externalTgzUrl },
      { local: DripperContract.artifact },
    ];
  }
  return [{ local: DripperContract.artifact }];
}

function tokenArtifactSources(config: NetworkConfig): ArtifactSourceConfig[] {
  if (config.name === 'devnet') {
    return [
      { registry: registryUrl },
      { external: externalTgzUrl },
      { local: TokenContract.artifact },
    ];
  }
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
    classId: (config) =>
      config.name === 'devnet' ? CLASS_IDS.dripper : undefined,
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
    classId: (config) =>
      config.name === 'devnet' ? CLASS_IDS.token : undefined,
  },
});
