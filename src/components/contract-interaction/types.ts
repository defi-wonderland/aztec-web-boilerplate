import type { ParsedFunction, ArtifactSummary } from '../../types/artifact';

/**
 * Mode for contract function calls (simulate vs execute).
 */
export type CallMode = 'simulate' | 'execute';

/**
 * Status for invoke operations.
 */
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
  timestamp: number;
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

// Re-export from contractInteraction
export type { ArtifactSummary };
