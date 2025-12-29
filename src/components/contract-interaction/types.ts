import type { ParsedFunction } from '../../utils/contractInteraction';

export type LogLevel = 'info' | 'error' | 'success';

export interface LogEntry {
  id: string;
  level: LogLevel;
  title: string;
  detail?: string;
}

export interface FunctionGroup {
  id: string;
  label: string;
  items: ParsedFunction[];
}

export type CachedContract = {
  address: string;
  artifact?: string;
  artifactKey?: string;
  label?: string;
  savedAt?: number;
};

export interface ArtifactLoaderProps {
  address: string;
  artifactInput: string;
  onAddressChange: (value: string) => void;
  onArtifactChange: (value: string) => void;
  onLoad: () => void;
  onClear: () => void;
  hasCache: boolean;
  savedContracts: CachedContract[];
  onApplySaved: (contract: CachedContract) => void;
  onDeleteSaved: (address: string) => void;
  error?: string | null;
  isValidAddress: boolean;
  activeAddress: string;
}

export interface FunctionListProps {
  groups: FunctionGroup[];
  selected: string | null;
  onSelect: (name: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  contractName?: string;
  hasContract: boolean;
}

export interface FunctionFormProps {
  fn: ParsedFunction;
  values: Record<string, string>;
  onChange: (path: string, value: string) => void;
  disabled: boolean;
}

