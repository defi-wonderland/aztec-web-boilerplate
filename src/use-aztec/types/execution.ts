import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { WriteContractData, ReadContractResult } from './contractTypes';
export type { WriteContractData, ReadContractResult };

/** Parameters for a single contract read execution. */
export interface ReadExecutionParams {
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: readonly unknown[];
}

/** Parameters for batch contract read execution. */
export interface BatchReadExecutionParams<
  TAllowFailure extends boolean = boolean,
> {
  contracts: ReadExecutionParams[];
  allowFailure: TAllowFailure;
}

/** Parameters for a contract write execution. */
export interface WriteExecutionParams {
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: readonly unknown[];
  feePaymentMethod?: unknown;
  timeout?: number;
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}

/** Conditional return type for batch reads based on `allowFailure`. */
export type BatchReadResult<TAllowFailure extends boolean> =
  TAllowFailure extends true ? ReadContractResult[] : unknown[];

/** Execution client injected into use-aztec via UseAztecProvider. */
export interface AztecExecutionClient {
  executeRead: (params: ReadExecutionParams) => Promise<unknown>;
  executeBatchRead: <TAllowFailure extends boolean>(
    params: BatchReadExecutionParams<TAllowFailure>
  ) => Promise<BatchReadResult<TAllowFailure>>;
  executeWrite: (params: WriteExecutionParams) => Promise<WriteContractData>;
}
