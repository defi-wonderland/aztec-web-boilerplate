import { AztecAddress, Fr } from '@aztec/aztec.js';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/Token.js';
import { TokenContract as AztecTokenContract } from '@aztec/noir-contracts.js/Token';
import { createContractConfig } from '../contracts';

/**
 * Application contract configurations.
 *
 * Defines all contracts used by the application with their artifacts,
 * address derivation, and deployment parameters.
 *
 * @example
 * ```tsx
 * // In provider setup
 * <AztecContractProvider
 *   contracts={aztecContracts}
 *   pxe={pxe}
 *   config={appConfig}
 * >
 *
 * // In components
 * const { instance } = useContract('dripper');
 * const { instance } = useContract('token');
 * ```
 */
export const aztecContracts = createContractConfig({
  /**
   * Dripper contract - Mints tokens to users
   */
  dripper: {
    artifact: DripperContract.artifact,
    address: (config) => config.dripperContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.dripperDeploymentSalt),
      deployer: AztecAddress.fromString(config.deployerAddress),
      constructorArgs: [],
      constructorArtifact: 'constructor',
    }),
  },

  /**
   * Token contract - Yield Token (YT)
   */
  token: {
    artifact: TokenContract.artifact,
    address: (config) => config.tokenContractAddress,
    deployParams: (config) => ({
      salt: Fr.fromString(config.tokenDeploymentSalt),
      deployer: AztecAddress.fromString(config.deployerAddress),
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

  /**
   * WETH contract - Wrapped Ethereum (testnet only)
   * Note: This uses hardcoded deployer/salt for the testnet WETH deployment
   */
  weth: {
    artifact: AztecTokenContract.artifact,
    address: () => '0x2103c4465e9d73a7b400576451beae75839e215178c0846120e9ed261ebf4f58', // Hardcoded testnet WETH address
    deployParams: () => {
      const wethDeployer = AztecAddress.fromString(
        '0x2103c4465e9d73a7b400576451beae75839e215178c0846120e9ed261ebf4f58'
      );
      return {
        salt: Fr.fromHexString(
          '0x21709ebd7c082ffe19291eca4b0ab5220814dbc07d79e8c876c1a37f3bbf3cd0'
        ),
        deployer: wethDeployer,
        constructorArgs: [wethDeployer, 'Wrapped Ethereum', 'WETH', 18],
        constructorArtifact: 'constructor',
      };
    },
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
 * Testnet-specific contracts that should be loaded when on testnet
 */
export const TESTNET_CONTRACTS: AppContractNames[] = ['weth'];

/**
 * Get the list of contracts to eagerly load based on network config
 */
export const getEagerLoadContracts = (isTestnet: boolean): AppContractNames[] => {
  if (isTestnet) {
    return [...CORE_CONTRACTS, ...TESTNET_CONTRACTS];
  }
  return CORE_CONTRACTS;
};


