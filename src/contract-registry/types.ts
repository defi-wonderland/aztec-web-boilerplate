import type { ContractArtifact, FunctionAbi } from '@aztec/stdlib/abi';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Fr } from '@aztec/aztec.js/fields';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { AppConfig } from '../config/networks';

/**
 * Status of a contract in the registry
 */
export type ContractStatus = 'idle' | 'checking' | 'registering' | 'ready' | 'error';

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
 * Contract class interface - any class with a static `at` method
 */
export interface ContractClass<TContract = unknown> {
  at: (address: AztecAddress, wallet: Wallet) => Promise<TContract>;
}

/**
 * Configuration for a single contract in the registry
 */
export interface ContractConfigDefinition<TConfig = AppConfig, TContract = unknown> {
  /** The contract artifact containing ABI and bytecode */
  artifact: ContractArtifact;
  /** The contract class with static `at` method for creating callable instances */
  contract: ContractClass<TContract>;
  /** Function to derive the expected contract address from app config */
  address: (config: TConfig) => string;
  /** Function to derive deployment parameters from app config */
  deployParams: (config: TConfig) => ContractDeployParams;
}

/**
 * Map of contract names to their configurations
 */
export type ContractConfigMap<TConfig = AppConfig> = Record<
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
 * Return type for useContractRegistration hook
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
  /** Overall registry status */
  status: 'initializing' | 'ready' | 'error';
  /** Error if registry initialization failed */
  error?: Error;
}

/**
 * Context value for the contract registry
 */
export interface ContractRegistryContextValue<T extends ContractConfigMap> {
  registry: IContractRegistry<T> | null;
  status: 'initializing' | 'ready' | 'error';
  error?: Error;
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
  /** Get the contract class for creating callable instances */
  getContractClass(name: ContractNames<T>): ContractClass | null;
  /** Register a contract (checks PXE's IndexedDB first, no-op if already registered) */
  register(name: ContractNames<T>): Promise<void>;
  /** Register multiple contracts sequentially (IndexedDB safe) */
  registerAll(names?: ContractNames<T>[]): Promise<void>;
  /** Get all registered contract names */
  getRegisteredNames(): ContractNames<T>[];
  /** Subscribe to status changes */
  subscribe(callback: () => void): () => void;
  /** Clear the in-memory cache */
  clearCache(): void;
}
