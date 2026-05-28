/**
 * use-aztec Type Exports
 *
 * All types are self-contained within use-aztec.
 */

// Contract types
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
