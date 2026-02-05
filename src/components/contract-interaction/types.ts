import type { PreconfiguredContract } from '../../config/preconfiguredContracts';
import type { CachedContract } from '../../services/storage';
import type { FormValues } from '../../store/form';
import type { ParsedFunction, ArtifactSummary } from '../../types/artifact';
import type { DeployableContract } from '../../utils/deployableContracts';

export type InvokeStatus = 'idle' | 'simulating' | 'executing';

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
 * Props for PreconfiguredSelector component.
 */
export interface PreconfiguredSelectorProps {
  preconfigured: PreconfiguredContract[];
  selectedId: string | null;
  onSelect: (contractId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

// Re-export from contractInteraction
export type { ArtifactSummary };

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
  artifactSummary?: ArtifactSummary | null;
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
  formValues: Record<string, string>;
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
