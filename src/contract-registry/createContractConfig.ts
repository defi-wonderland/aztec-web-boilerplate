import type { ContractConfigMap, ContractConfigDefinition } from './types';
import type { AppConfig } from '../config/networks';

/**
 * Creates a type-safe contract configuration map.
 * 
 * This helper function provides full TypeScript inference for contract names
 * and validates that all contract definitions follow the correct structure.
 * 
 * @example
 * ```typescript
 * const contracts = createContractConfig({
 *   dripper: {
 *     artifact: DripperContract.artifact,
 *     address: (config) => config.dripperContractAddress,
 *     deployParams: (config) => ({
 *       salt: Fr.fromString(config.dripperDeploymentSalt),
 *       deployer: AztecAddress.fromString(config.deployerAddress),
 *       constructorArgs: [],
 *       constructorArtifact: 'constructor',
 *     }),
 *   },
 *   token: {
 *     artifact: TokenContract.artifact,
 *     address: (config) => config.tokenContractAddress,
 *     deployParams: (config) => ({
 *       salt: Fr.fromString(config.tokenDeploymentSalt),
 *       deployer: AztecAddress.fromString(config.deployerAddress),
 *       constructorArgs: ['Yield Token', 'YT', 18, ...],
 *       constructorArtifact: 'constructor_with_minter',
 *     }),
 *   },
 * });
 * 
 * // TypeScript knows the contract names
 * type Names = keyof typeof contracts; // 'dripper' | 'token'
 * ```
 * 
 * @param configs - Object mapping contract names to their configurations
 * @returns The same config object with proper type inference
 */
export const createContractConfig = <
  T extends Record<string, ContractConfigDefinition<AppConfig>>
>(
  configs: T
): T & ContractConfigMap<AppConfig> => {
  // Validate that all configs have required properties
  for (const [name, config] of Object.entries(configs)) {
    if (!config.artifact) {
      throw new Error(`Contract "${name}" is missing required "artifact" property`);
    }
    if (typeof config.address !== 'function') {
      throw new Error(`Contract "${name}" is missing required "address" function`);
    }
    if (typeof config.deployParams !== 'function') {
      throw new Error(`Contract "${name}" is missing required "deployParams" function`);
    }
  }

  return configs;
};

/**
 * Type helper to extract contract names from a config
 */
export type InferContractNames<T> = T extends ContractConfigMap ? keyof T & string : never;

/**
 * Type helper to check if a string is a valid contract name
 */
export type IsValidContractName<T extends ContractConfigMap, K extends string> = 
  K extends keyof T ? true : false;



