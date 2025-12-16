import { Fr } from '@aztec/aztec.js/fields';
import { DripperContract } from '../artifacts/Dripper.js';
import { TokenContract } from '../artifacts/Token.js';
import {
  createContractConfig,
  getDeployerAddress,
  getTokenConstructorArgs,
} from '../contract-registry';

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
    lazyRegister: true,
  },
});
