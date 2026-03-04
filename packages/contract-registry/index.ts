// Core types
export type {
  ContractStatus,
  ContractDeployParams,
  ContractClass,
  ContractConfigDefinition,
  ContractConfigMap,
  ContractNames,
  RegisteredContract,
  UseContractReturn,
  UseContractRegistryReturn,
  IContractRegistry,
  ArtifactSourceConfig,
} from './core/types';

export type {
  ContractsConfig,
  ContractName,
  ContractTypeMap,
  ContractType,
  ContractInstanceFromClass,
} from './core/contractTypes';

// Adapter
export type { ContractRegistryWalletAdapter } from './adapter';

// Store
export { useContractRegistryStore, getContractRegistryStore } from './store';
export { useContractRegistryStatus } from './store/selectors';
export type {
  ContractRegistryStore,
  ContractRegistryStatus,
  ArtifactStatus,
} from './store';

// Hooks
export { useContract } from './hooks/useContract';
export { useContractRegistry } from './hooks/useContractRegistry';
export { useRequiredContracts } from './hooks/useRequiredContracts';
export {
  useArtifactLoader,
  type UseArtifactLoaderOptions,
  type UseArtifactLoaderResult,
} from './hooks/useArtifactLoader';

// Helpers
export { createContractConfig } from './core/helpers';

// Artifact services
export {
  ArtifactService,
  ArtifactRegistryService,
  type ResolvedArtifacts,
  type LoadArtifactsResult,
} from './services/artifact';
export {
  ArtifactStorageService,
  getArtifactStorageService,
} from './services/storage';
export type { CachedContract, ContractsRecord } from './services/storage/types';

// Artifact types
export {
  normalizeArtifactSource,
  type NormalizedArtifactSource,
} from './types/artifactSource';
export type {
  SerializedArtifact,
  CachedArtifact,
  ArtifactCacheOrigin,
  ArtifactResult,
  GetArtifactOptions,
} from './types/artifactRegistry';

// Provider
export { ContractRegistryProvider } from './provider/ContractRegistryProvider';
export type { ContractRegistryProviderProps } from './provider/ContractRegistryProvider';

// Registry class
export { ContractRegistry } from './core/ContractRegistry';
