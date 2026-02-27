/**
 * use-aztec Type Re-exports
 *
 * Re-exports contract types from the app's canonical source
 * plus use-aztec runtime execution types.
 */

// Contract types — source of truth stays in src/types/contractTypes.ts
export type {
  MethodsOf,
  ArgsOf,
  ContractClassFor,
  ContractQueryOptions,
  UseReadContractParams,
  UseReadContractReturn,
  WriteContractData,
  WriteContractMutateParams,
  WriteContractCallOptions,
  UseWriteContractOptions,
  UseWriteContractReturn,
  ReadContractsContract,
  ReadContractResult,
  UseReadContractsParams,
  UseReadContractsReturn,
} from '../../types/contractTypes';

// Runtime types
export type {
  AztecExecutionClient,
  ReadExecutionParams,
  BatchReadExecutionParams,
  BatchReadContract,
  BatchReadResult,
  WriteExecutionParams,
} from '../runtime/types';

// Action param types
export type { ReadContractActionParams } from '../actions/readContract';
export type { ReadContractsActionParams } from '../actions/readContracts';
