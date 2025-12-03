import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
// Use LOCAL artifacts (compiled from Wonderland aztec-standards source)
import { DripperContract } from '../artifacts/Dripper.js';
import { TokenContract } from '../artifacts/Token.js';
import { createContractConfig } from '../contract-registry';

export const aztecContracts = createContractConfig({
  /**
   * Dripper contract - Mints tokens to users
   * Deployed with universalDeploy=true, so deployer is AztecAddress.ZERO
   */
  dripper: {
    artifact: DripperContract.artifact,
    contract: DripperContract,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.dripperDeploymentSalt),
      deployer: AztecAddress.ZERO, // universalDeploy uses ZERO deployer
      constructorArgs: [],
      constructorArtifact: 'constructor',
    }),
  },

  /**
   * Token contract - Yield Token (YT)
   * Deployed with universalDeploy=true, so deployer is AztecAddress.ZERO
   * Uses Wonderland token with minter set to Dripper address
   */
  token: {
    artifact: TokenContract.artifact,
    contract: TokenContract,
    address: (config) => config.tokenContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.tokenDeploymentSalt),
      deployer: AztecAddress.ZERO, // universalDeploy uses ZERO deployer
      constructorArgs: [
        'Yield Token', // name
        'YT', // symbol
        18, // decimals
        AztecAddress.fromString(config.dripperContractAddress), // minter (Dripper address)
        AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
      ],
      constructorArtifact: 'constructor_with_minter',
    }),
  },
});

/**
 * Type-safe contract names for this application
 */
export type AppContractNames = keyof typeof aztecContracts;

/**
 * Core contracts that should always be loaded at initialization
 */
export const CORE_CONTRACTS: AppContractNames[] = ['dripper', 'token'];

/**
 * Get the list of contracts to eagerly load based on network config
 */
export const getEagerLoadContracts = (): AppContractNames[] => {
  return CORE_CONTRACTS;
};
