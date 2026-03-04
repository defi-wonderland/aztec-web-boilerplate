import { DripperContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import {
  createContractConfig,
  type ArtifactSourceConfig,
  type ContractConfigMap,
} from '@contract-registry';
import { DEFAULT_ARTIFACT_REGISTRY_URL } from '../../../config/networks/constants';
import { getEnv } from '../../../utils/env';
import { MINT_CLASS_IDS, getMintFeatureDeployment } from './mint';

const env = getEnv();

const registryUrl = env.artifactRegistryUrl ?? DEFAULT_ARTIFACT_REGISTRY_URL;

const DEFAULT_EXTERNAL_TGZ_URL =
  'https://github.com/defi-wonderland/aztec-standards/releases/download/prerelease-69dc5c4/defi-wonderland-aztec-standards-4.0.0-devnet.2-patch.1-prerelease.69dc5c4.tgz';

function toProxiedGithubUrl(url: string): string {
  return url.replace(/^https:\/\/github\.com\//, '/github-releases/');
}

const externalTgzUrl = toProxiedGithubUrl(
  env.externalTgzUrl ?? DEFAULT_EXTERNAL_TGZ_URL
);

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

export const mintFeatureContracts: ContractConfigMap = createContractConfig({
  dripper: {
    contract: DripperContract,
    address: (config) =>
      getMintFeatureDeployment(config.name).dripperContract.address,
    deployParams: (config) => {
      const deployment = getMintFeatureDeployment(config.name);
      return {
        salt: Fr.fromString(deployment.dripperContract.salt),
        deployer: AztecAddress.fromString(deployment.deployer),
        constructorArgs: [],
        constructorArtifact: 'constructor',
      };
    },
    lazyRegister: false,
    artifactSources: dripperArtifactSources,
    classId: () => MINT_CLASS_IDS.dripper,
  },
  token: {
    contract: TokenContract,
    address: (config) =>
      getMintFeatureDeployment(config.name).tokenContract.address,
    deployParams: (config) => {
      const deployment = getMintFeatureDeployment(config.name);
      return {
        salt: Fr.fromString(deployment.tokenContract.salt),
        deployer: AztecAddress.fromString(deployment.deployer),
        constructorArgs: [
          'WETH',
          'WETH',
          18,
          AztecAddress.fromString(deployment.dripperContract.address),
          AztecAddress.ZERO,
        ],
        constructorArtifact: 'constructor_with_minter',
      };
    },
    lazyRegister: true,
    artifactSources: tokenArtifactSources,
    classId: () => MINT_CLASS_IDS.token,
  },
});
