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
 * Falls back to `never` when the type doesn't match — this prevents silent
 * type holes when a config entry omits the optional `contract` field.
 */
type InferContractInstance<T> = T extends {
  at(address: infer _A, wallet: infer _W): infer C;
}
  ? C
  : never;

/**
 * Maps contract names to their corresponding contract types.
 * When `contract` is present, infers the typed instance.
 * When absent, falls back to `never` so callers know it's untyped.
 */
export type ContractTypeMap = {
  [K in ContractName]: ContractsConfig[K] extends { contract: infer CC }
    ? InferContractInstance<CC>
    : never;
};

/**
 * Get the contract type for a given contract name.
 * Infers from the `contract` property's static `at` method return type.
 */
export type ContractType<K extends ContractName> = ContractTypeMap[K];
