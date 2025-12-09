import { Fr } from '@aztec/aztec.js/fields';
import {
  loadContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
import { DripperContract } from '../artifacts/Dripper.js';
import { TokenContract } from '../artifacts/Token.js';
import {
  createContractConfig,
  getDeployerAddress,
  getTokenConstructorArgs,
  type ArtifactOverrides,
} from '../contract-registry';
import dripperDevnetArtifactJson from '../artifacts/devnet/dripper-Dripper.json' with { type: 'json' };
import tokenDevnetArtifactJson from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };

/**
 * Edit this file to add/remove contracts for your application.
 *
 * By default, all contracts are registered at initialization.
 * Set `lazyRegister: true` on a contract to only register it on-demand.
 */
export const contractsConfig = createContractConfig({
  /**
   * Dripper contract - Mints tokens to users
   */
  dripper: {
    artifact: DripperContract.artifact,
    contract: DripperContract,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.dripperDeploymentSalt),
      deployer: getDeployerAddress(config),
      constructorArgs: [],
      constructorArtifact: 'constructor',
    }),
    lazyRegister: false,
  },

  /**
   * Token contract - Yield Token (YT)
   */
  token: {
    artifact: TokenContract.artifact,
    contract: TokenContract,
    address: (config) => config.tokenContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.tokenDeploymentSalt),
      deployer: getDeployerAddress(config),
      constructorArgs: [...getTokenConstructorArgs(config)],
      constructorArtifact: 'constructor_with_minter',
    }),
    lazyRegister: false,
  },
});

//TODO: Move this to a different file, here users should have access only to config

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
