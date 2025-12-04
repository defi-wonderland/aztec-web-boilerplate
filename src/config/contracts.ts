import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import {
  loadContractArtifact,
  type ContractArtifact,
  type NoirCompiledContract,
} from '@aztec/aztec.js/abi';
// Use LOCAL artifacts (compiled from Wonderland aztec-standards source)
import { DripperContract } from '../artifacts/Dripper.js';
import { TokenContract } from '../artifacts/Token.js';
import { createContractConfig } from '../contract-registry';
import type { AppConfig } from './networks';
import dripperDevnetArtifactJson from '../artifacts/devnet/dripper-Dripper.json' with { type: 'json' };
import tokenDevnetArtifactJson from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };

const getDeployerAddress = (config: AppConfig): AztecAddress => {
  switch (config.name) {
    case 'sandbox':
      return AztecAddress.ZERO;
    case 'devnet':
      return config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : AztecAddress.ZERO;
    default:
      return config.deployerAddress
        ? AztecAddress.fromString(config.deployerAddress)
        : AztecAddress.ZERO;
  }
};

const getTokenConstructorArgs = (config: AppConfig) => {
  const minterAddress = AztecAddress.fromString(config.dripperContractAddress);

  switch (config.name) {
    case 'devnet':
      return ['WETH', 'WETH', 18, minterAddress, AztecAddress.ZERO] as const;
    default:
      return ['Yield Token', 'YT', 18, minterAddress, AztecAddress.ZERO] as const;
  }
};

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
    deployer: getDeployerAddress(config),
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
    deployer: getDeployerAddress(config),
      constructorArgs: [
      ...getTokenConstructorArgs(config),
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

const DRIPPER_DEVNET_ARTIFACT = loadContractArtifact(
  dripperDevnetArtifactJson as NoirCompiledContract
);
const TOKEN_DEVNET_ARTIFACT = loadContractArtifact(
  tokenDevnetArtifactJson as NoirCompiledContract
);

/**
 * Returns contract configs adjusted for the active network.
 * Devnet uses pinned artifacts that match the public deployment.
 */
export const getContractsForConfig = (
  config: AppConfig
): typeof aztecContracts => {
  if (config.name !== 'devnet') {
    return aztecContracts;
  }

  return {
    ...aztecContracts,
    dripper: {
      ...aztecContracts.dripper,
      artifact: DRIPPER_DEVNET_ARTIFACT as ContractArtifact,
    },
    token: {
      ...aztecContracts.token,
      artifact: TOKEN_DEVNET_ARTIFACT as ContractArtifact,
    },
  };
};
