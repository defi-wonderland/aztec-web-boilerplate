import type { ContractArtifact, FunctionAbi } from '@aztec/stdlib/abi';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Fr } from '@aztec/aztec.js/fields';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import type { PXE } from '@aztec/pxe/server';
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
 * Configuration for a single contract in the registry
 */
export interface ContractConfigDefinition<TConfig = AppConfig> {
  /** The contract artifact containing ABI and bytecode */
  artifact: ContractArtifact;
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
  ContractConfigDefinition<TConfig>
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
 * Registry state containing all registered contracts
 */
export interface RegistryState<T extends ContractConfigMap> {
  contracts: Map<ContractNames<T>, RegisteredContract>;
  status: 'initializing' | 'ready' | 'error';
  error?: Error;
}

/**
 * Props for the AztecContractProvider
 */
export interface AztecContractProviderProps<T extends ContractConfigMap> {
  /** Contract configurations created with createContractConfig */
  contracts: T;
  /** PXE instance for contract registration */
  pxe: PXE;
  /** App configuration for deriving addresses and deploy params */
  config: AppConfig;
  /** 
   * List of contract names to eagerly load at initialization.
   * - undefined (default): Load all contracts at init
   * - string[]: Load only specified contracts at init
   * - []: Load no contracts at init (all lazy)
   */
  eagerLoad?: ContractNames<T>[];
  /** React children */
  children: React.ReactNode;
}

/**
 * Return type for useContract hook
 */
export interface UseContractReturn {
  /** The contract instance if registered */
  instance: ContractInstanceWithAddress | null;
  /** Current status of the contract */
  status: ContractStatus;
  /** Error if registration failed */
  error: Error | null;
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
  /** Ensure a contract is registered (no-op if already registered) */
  ensureRegistered: (name: ContractNames<T>) => Promise<void>;
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
  /** Check if a contract is registered in the cache */
  isRegistered(name: ContractNames<T>): boolean;
  /** Get the instance of a registered contract */
  getInstance(name: ContractNames<T>): ContractInstanceWithAddress | null;
  /** Get the status of a contract */
  getStatus(name: ContractNames<T>): ContractStatus;
  /** Ensure a contract is registered (checks PXE first) */
  ensureRegistered(name: ContractNames<T>): Promise<void>;
  /** Register multiple contracts in parallel */
  registerAll(names?: ContractNames<T>[]): Promise<void>;
  /** Get all registered contract names */
  getRegisteredNames(): ContractNames<T>[];
  /** Subscribe to status changes */
  subscribe(callback: () => void): () => void;
}

