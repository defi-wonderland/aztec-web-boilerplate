import { CachedContract } from '../../utils/contractCache';
import type { PreconfiguredContract } from '../../config/preconfiguredContracts';
import type { FormValues } from '../../store/form';
import type { ParsedFunction } from '../../utils/contractInteraction';
import type { DeployableContract } from '../../utils/deployableContracts';

export type LogLevel = 'info' | 'error' | 'success' | 'warning';

export interface DeployResult {
  success: boolean;
  address?: string;
  txHash?: string;
  error?: string;
}

/**
 * Log entry for operation history.
 */
export interface LogEntry {
  id: string;
  level: 'info' | 'error' | 'success';
  title: string;
  detail?: string;
}

/**
 * Function group for categorizing contract functions.
 */
export interface FunctionGroup {
  id: string;
  label: string;
  items: ParsedFunction[];
}

/**
 * Mode for the artifact loader - either use existing or deploy new.
 */
export type ArtifactLoaderMode = 'existing' | 'deploy';

// =============================================================================
// Component Props
// =============================================================================

/**
 * State for deployment form values.
 */
export type DeploymentFormValues = Record<string, string>;

/**
 * Props for PreconfiguredSelector component.
 */
export interface PreconfiguredSelectorProps {
  preconfigured: PreconfiguredContract[];
  selectedId: string | null;
  onSelect: (contractId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Props for ExistingContractForm component.
 */
export interface ExistingContractFormProps {
  address: string;
  artifactInput: string;
  onAddressChange: (value: string) => void;
  onArtifactChange: (value: string) => void;
  onLoad: () => void;
  error?: string | null;
  isValidAddress: boolean;
  isPreconfiguredMode: boolean;
  isLoadingPreconfigured?: boolean;
  canLoad: boolean;
}

/**
 * Props for SavedContractsList component.
 */
export interface SavedContractsListProps {
  contracts: CachedContract[];
  activeAddress: string;
  onApply: (contract: CachedContract) => void;
  onDelete: (address: string) => void;
  onClearAll: () => void;
  canClear: boolean;
}

/**
 * Props for DeployContractForm component.
 */
export interface DeployContractFormProps {
  deployableContracts: DeployableContract[];
  selectedDeployableId: string | null;
  onSelectDeployable: (contractId: string | null) => void;
  isCustomSelected: boolean;
  customDeployable: DeployableContract | null;
  selectedConstructorName: string | null;
  onSelectConstructor: (constructorName: string) => void;
  formValues: DeploymentFormValues;
  onFormValueChange: (paramName: string, value: string) => void;
  onDeploy: () => void;
  isDeploying: boolean;
  deploymentError?: string | null;
  canDeploy: boolean;
  customArtifactInput: string;
  onCustomArtifactChange: (value: string) => void;
  customArtifactError?: string | null;
}

/**
 * Grouped config for existing contract form.
 */
export interface ExistingContractConfig {
  address: string;
  artifactInput: string;
  onAddressChange: (value: string) => void;
  onArtifactChange: (value: string) => void;
  onLoad: () => void;
  error?: string | null;
  isValidAddress: boolean;
}

/**
 * Grouped config for saved contracts management.
 */
export interface SavedContractsConfig {
  contracts: CachedContract[];
  activeAddress: string;
  onApply: (contract: CachedContract) => void;
  onDelete: (address: string) => void;
  onClearAll: () => void;
  hasCache: boolean;
}

/**
 * Grouped config for preconfigured contracts selector.
 */
export interface PreconfiguredConfig {
  options: PreconfiguredContract[];
  selectedId: string | null;
  onSelect: (contractId: string | null) => void;
  isLoading?: boolean;
}

/**
 * Grouped config for contract deployment.
 */
export interface DeployConfig {
  contracts: DeployableContract[];
  selectedContractId: string | null;
  onSelectContract: (contractId: string | null) => void;
  isCustomSelected: boolean;
  customDeployable: DeployableContract | null;
  selectedConstructorName: string | null;
  onSelectConstructor: (constructorName: string) => void;
  formValues: DeploymentFormValues;
  onFormValueChange: (paramName: string, value: string) => void;
  onDeploy: () => void;
  isDeploying: boolean;
  error?: string | null;
  canDeploy: boolean;
  customArtifactInput: string;
  onCustomArtifactChange: (value: string) => void;
  customArtifactError?: string | null;
}

/**
 * Props for ArtifactLoader orchestrator component.
 * Uses grouped configs for cleaner API.
 */
export interface ArtifactLoaderProps {
  mode?: ArtifactLoaderMode;
  existing: ExistingContractConfig;
  saved: SavedContractsConfig;
  preconfigured?: PreconfiguredConfig;
  deploy?: DeployConfig;
}

/**
 * Props for FunctionList component.
 */
export interface FunctionListProps {
  groups: FunctionGroup[];
  selected: string | null;
  onSelect: (name: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  contractName?: string;
  hasContract: boolean;
}

/**
 * Props for FunctionForm component.
 */
export interface FunctionFormProps {
  fn: ParsedFunction;
  values: FormValues;
  onChange: (path: string, value: string) => void;
  disabled: boolean;
}
