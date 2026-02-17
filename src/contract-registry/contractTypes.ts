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
 * Returns `unknown` for contracts without a bundled typed class.
 */
type InferContractInstance<T> = T extends {
  at(address: infer _A, wallet: infer _W): infer C;
}
  ? C
  : unknown;

/**
 * Maps contract names to their corresponding contract types.
 * Contracts with a bundled class get full type inference.
 * External-only contracts (no `contract` field) resolve to `unknown`.
 */
export type ContractTypeMap = {
  [K in ContractName]: InferContractInstance<
    ContractsConfig[K] extends { contract: infer C } ? C : never
  >;
};

/**
 * Get the contract type for a given contract name.
 * Infers from the `contract` property's static `at` method return type.
 */
export type ContractType<K extends ContractName> = ContractTypeMap[K];
