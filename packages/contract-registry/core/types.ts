import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import type { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { ContractArtifact, FunctionAbi } from '@aztec/stdlib/abi';

/**
 * Describes how to fetch artifacts from a specific source.
 *
 * - `registry` — Fetch from an artifact registry by classId (verified).
 * - `external` — Fetch a tgz package from a URL and match artifacts by name.
 * - `local` — Use a bundled artifact directly (no network request).
 */
export type ArtifactSourceConfig =
  | { registry: string }
  | { external: string }
  | { local: ContractArtifact };

/**
 * Status of a contract in the registry
 * - idle: Not registered, not attempted
 * - registering: Currently being registered with PXE
 * - ready: Successfully registered and available
 * - error: Registration failed
 */
export type ContractStatus = 'idle' | 'registering' | 'ready' | 'error';

/**
 * Parameters needed to compute a contract instance from deployment
 */
export interface ContractDeployParams {
  salt: Fr;
  deployer: AztecAddress;
  constructorArgs: unknown[];
  constructorArtifact: FunctionAbi | string;
}

/**
 * Contract class interface — any class with a static `at` method.
 * Used purely for type inference so useContract() returns a typed instance.
 */
export interface ContractClass<TContract = unknown> {
  at: (address: AztecAddress, wallet: Wallet) => TContract;
}

/**
 * Configuration for a single contract in the registry.
 *
 * TConfig defaults to `any` so the module stays agnostic to the app's
 * network-config shape. Concrete definitions can narrow it (e.g.
 * `ContractConfigDefinition<NetworkConfig>`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ContractConfigDefinition<TConfig = any, TContract = unknown> {
  /**
   * Optional contract class for type inference.
   * If provided, useContract() returns a fully typed instance with autocomplete for methods.
   * If omitted, useContract() returns an untyped (`unknown`) instance with no autocomplete.
   */
  contract?: ContractClass<TContract>;
  /** Function to derive the expected contract address from app config */
  address: (config: TConfig) => string;
  /** Function to derive deployment parameters from app config */
  deployParams: (config: TConfig) => ContractDeployParams;
  /** If true, contract won't be registered at init (on-demand only). Default: false */
  lazyRegister?: boolean;
  /** Ordered fallback chain of artifact sources for this contract (first success wins) */
  artifactSources: (config: TConfig) => ArtifactSourceConfig[];
  /** Class ID used by registry sources to look up this contract's artifact */
  classId?: (config: TConfig) => string | undefined;
}

/**
 * Map of contract names to their configurations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContractConfigMap<TConfig = any> = Record<
  string,
  ContractConfigDefinition<TConfig, unknown>
>;

/**
 * Infer contract names from a config map
 */
export type ContractNames<T extends ContractConfigMap> = keyof T & string;

/**
 * State of a registered contract in the cache
 */
export interface RegisteredContract {
  instance: ContractInstanceWithAddress;
  status: ContractStatus;
  error?: Error;
}

/**
 * Return type for useContract hook
 */
export interface UseContractReturn<TContract = unknown> {
  /** The callable contract instance if registered and ready */
  contract: TContract | null;
  /** Current status of the contract */
  status: ContractStatus;
  /** Error if registration failed */
  error: Error | null;
  /** Whether the contract is ready to use */
  isReady: boolean;
  /** Function to manually trigger registration */
  register: () => Promise<void>;
}

/**
 * Return type for useContractRegistry hook
 */
export interface UseContractRegistryReturn<T extends ContractConfigMap> {
  /** Check if a contract is registered */
  isRegistered: (name: ContractNames<T>) => boolean;
  /** Get a contract instance by name */
  getInstance: (name: ContractNames<T>) => ContractInstanceWithAddress | null;
  /** Get the status of a contract */
  getStatus: (name: ContractNames<T>) => ContractStatus;
  /** Register a contract (no-op if already registered) */
  register: (name: ContractNames<T>) => Promise<void>;
  /** Register multiple contracts */
  registerMany: (names: ContractNames<T>[]) => Promise<void>;
  /** Get all registered contract names */
  getRegisteredNames: () => ContractNames<T>[];
  /** Subscribe to registry state changes */
  subscribe: (callback: () => void) => () => void;
  /** Overall registry status */
  status: 'initializing' | 'ready' | 'error';
}

/**
 * Interface for the ContractRegistry class
 */
export interface IContractRegistry<T extends ContractConfigMap> {
  /** Check if a contract is registered in the memory cache */
  isRegistered(name: ContractNames<T>): boolean;
  /** Get the instance of a registered contract */
  getInstance(name: ContractNames<T>): ContractInstanceWithAddress | null;
  /** Get the status of a contract */
  getStatus(name: ContractNames<T>): ContractStatus;
  /** Register a single contract (no-op if already registered) */
  register(name: ContractNames<T>): Promise<void>;
  /** Ensure contracts are registered (syncs from storage first, then registers missing) */
  registerAll(names?: ContractNames<T>[]): Promise<void>;
  /** Get all registered contract names */
  getRegisteredNames(): ContractNames<T>[];
  /** Subscribe to status changes */
  subscribe(callback: () => void): () => void;
  /** Clear the in-memory cache */
  clearCache(): void;
}
