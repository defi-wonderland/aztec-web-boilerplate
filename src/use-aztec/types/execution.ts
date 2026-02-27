import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type {
  WriteContractData,
  ReadContractResult,
} from '../../types/contractTypes';
export type { WriteContractData, ReadContractResult };

/** Parameters for a single contract read execution. */
export interface ReadExecutionParams {
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: unknown[];
}

/** A single contract read within a batch. */
export interface BatchReadContract {
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: unknown[];
}

/** Parameters for batch contract read execution. */
export interface BatchReadExecutionParams {
  contracts: BatchReadContract[];
  allowFailure: boolean;
}

/** Parameters for a contract write execution. */
export interface WriteExecutionParams {
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: unknown[];
  feePaymentMethod?: unknown;
  timeout?: number;
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}

/** Execution client injected into use-aztec via UseAztecProvider. */
export interface AztecExecutionClient {
  executeRead: (params: ReadExecutionParams) => Promise<unknown>;
  executeBatchRead: (
    params: BatchReadExecutionParams
  ) => Promise<ReadContractResult[] | unknown[]>;
  executeWrite: (params: WriteExecutionParams) => Promise<WriteContractData>;
}
