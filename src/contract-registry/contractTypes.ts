/**
 * Types derived from the contracts configuration.
 */
import { contractsConfig } from '../config/contracts';

/** Type representing the contracts config map */
export type ContractsConfig = typeof contractsConfig;

/**
 * Valid contract names derived from the config.
 * Provides autocomplete for contract names: 'dripper' | 'token' | ...
 */
export type ContractName = keyof ContractsConfig;

/**
 * Extracts the return type of a static `at` method from a contract class.
 */
type ContractFromClass<T> = T extends { at: (...args: never[]) => infer R }
  ? R
  : unknown;

/**
 * Maps contract names to their corresponding contract types.
 * @deprecated Use ContractType<K> directly instead
 */
export type ContractTypeMap = {
  [K in ContractName]: ContractFromClass<ContractsConfig[K]['contract']>;
};

/**
 * Get the contract type for a given contract name.
 * Infers from the `contract` property's static `at` method return type.
 */
export type ContractType<K extends ContractName> = ContractFromClass<
  ContractsConfig[K]['contract']
>;
