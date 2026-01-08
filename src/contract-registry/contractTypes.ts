/**
 * Types derived from the contracts configuration.
 */
import { contractsConfig } from '../config/contracts';

/** Type representing the contracts config map */
export type ContractsConfig = typeof contractsConfig;

/** Valid contract names derived from the config */
export type ContractName = keyof ContractsConfig;

/**
 * Infers the contract instance type from a contract class with an `at` method.
 */
type InferContractInstance<T> = T extends { at(address: infer _A, wallet: infer _W): infer C }
  ? C
  : never;

/**
 * Extracts the contract type from a config entry's `contract` property.
 */
type ExtractContractType<T> = T extends { contract: infer C }
  ? InferContractInstance<C>
  : never;

/**
 * Maps contract names to their corresponding contract types.
 * Automatically inferred from contractsConfig.
 */
export type ContractTypeMap = {
  [K in ContractName]: ExtractContractType<ContractsConfig[K]>;
};

/**
 * Get the contract type for a given contract name.
 */
export type ContractType<K extends ContractName> = ContractTypeMap[K];

