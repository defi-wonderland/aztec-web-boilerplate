/**
 * Distributed contract type registry.
 *
 * Feature modules augment this interface so contract-name autocomplete stays
 * decoupled from runtime feature discovery.
 */
export interface ContractTypeRegistry {}

/** Backward-compatible alias for existing imports. */
export type ContractsConfig = ContractTypeRegistry;

/** Valid contract names contributed by feature-local augmentations. */
export type ContractName = keyof ContractTypeRegistry & string;

/**
 * Extracts contract instance type from a contract class static `at` method.
 */
export type ContractInstanceFromClass<T> = T extends {
  at: (...args: infer _Args) => infer R;
}
  ? Awaited<R>
  : never;

/** Full mapping of contract names to typed instances. */
export type ContractTypeMap = ContractTypeRegistry;

/** Contract instance type for a given contract name. */
export type ContractType<K extends ContractName> = ContractTypeRegistry[K];
