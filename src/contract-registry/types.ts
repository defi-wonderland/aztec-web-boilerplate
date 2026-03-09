import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import type { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { FunctionAbi } from '@aztec/stdlib/abi';
import type { NetworkDeployments } from '../config/deployments/types';
import type { ArtifactSourceConfig } from '../types/artifactSource';

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
 * Defines WHAT the contract is (artifact, constructor, sources).
 * WHERE the contract is deployed (address, salt, deployer) comes from
 * deployment files and is resolved by the registry at runtime.
 */
export interface ContractConfigDefinition<TContract = unknown> {
  /**
   * Optional contract class for type inference.
   * If provided, useContract() returns a fully typed instance with autocomplete for methods.
   */
  contract?: ContractClass<TContract>;
  /** Constructor function name or ABI used for deterministic address computation */
  constructorArtifact: FunctionAbi | string;
  /**
   * Constructor arguments. Can be:
   * - A static array (simple contracts)
   * - A function receiving the network deployments map (cross-contract references)
   */
  constructorArgs: unknown[] | ((deployments: NetworkDeployments) => unknown[]);
  /** If true, contract won't be registered at init (on-demand only). Default: false */
  lazyRegister?: boolean;
  /** Ordered fallback chain of artifact sources (first success wins) */
  artifactSources: ArtifactSourceConfig[];
  /** Class ID used by registry sources to look up this contract's artifact */
  classId?: string;
}

/**
 * Map of contract names to their configurations
 */
export type ContractConfigMap = Record<
  string,
  ContractConfigDefinition<unknown>
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
