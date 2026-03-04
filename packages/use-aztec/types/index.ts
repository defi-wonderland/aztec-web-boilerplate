/**
 * use-aztec Type Re-exports
 *
 * Re-exports contract types from the app's canonical source
 * plus use-aztec execution client types.
 */

// Contract types — canonical source within use-aztec
export type {
  MethodsOf,
  ArgsOf,
  ContractClassFor,
  ScopeKey,
  ContractQueryOptions,
  UseReadContractParams,
  WriteContractData,
  WriteContractMutateParams,
  WriteContractCallOptions,
  UseWriteContractOptions,
  UseWriteContractReturn,
  WriteContractActionParams,
  ReadContractsContract,
  ReadContractResult,
  UseReadContractsParams,
} from './contractTypes';

// Execution client types
export type {
  AztecExecutionClient,
  BatchReadResult,
  ReadExecutionParams,
  BatchReadExecutionParams,
  WriteExecutionParams,
} from './execution';

// Action param types
export type { ReadContractActionParams } from '../actions/readContract';
export type { ReadContractsActionParams } from '../actions/readContracts';
