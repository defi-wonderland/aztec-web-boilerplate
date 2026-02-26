import type { ContractArtifact } from '@aztec/aztec.js/abi';

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

/** Result shape for individual results when allowFailure is true. */
export type BatchReadResult =
  | { status: 'success'; result: unknown; error?: undefined }
  | { status: 'failure'; result?: undefined; error: Error };

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

/** Data returned from a successful write operation. */
export interface WriteContractData {
  txHash?: string;
  result?: unknown;
}

/** Runtime client injected into use-aztec. */
export interface AztecExecutionClient {
  executeRead: (params: ReadExecutionParams) => Promise<unknown>;
  executeBatchRead: (
    params: BatchReadExecutionParams
  ) => Promise<BatchReadResult[] | unknown[]>;
  executeWrite: (params: WriteExecutionParams) => Promise<WriteContractData>;
}
