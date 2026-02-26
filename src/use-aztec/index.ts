/**
 * use-aztec — Wallet-agnostic React hooks for Aztec contract interaction.
 *
 * Provides `useReadContract`, `useWriteContract`, and `useReadContracts` hooks
 * that work with any wallet implementation via the UseAztecProvider + execution
 * client injection pattern.
 *
 * @example
 * ```tsx
 * import {
 *   UseAztecProvider,
 *   useReadContract,
 *   useWriteContract,
 * } from './use-aztec';
 *
 * const client = createExecutionClientSomehow();
 *
 * <UseAztecProvider client={client}>
 *   <App />
 * </UseAztecProvider>
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// PROVIDER & CONTEXT
// =============================================================================

export { UseAztecProvider } from './context';
export { AztecClientNotReadyError } from './runtime';

// =============================================================================
// HOOKS
// =============================================================================

export { useReadContract } from './hooks';
export { useWriteContract } from './hooks';
export { useReadContracts } from './hooks';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Runtime execution types
  AztecExecutionClient,
  ReadExecutionParams,
  BatchReadExecutionParams,
  BatchReadContract,
  BatchReadResult,
  WriteExecutionParams,
  // Contract types (re-exported from contractTypes.ts)
  MethodsOf,
  ArgsOf,
  ContractClassFor,
  ContractQueryOptions,
  ContractMutationOptions,
  UseReadContractParams,
  UseReadContractReturn,
  WriteContractData,
  WriteContractMutateParams,
  UseWriteContractOptions,
  UseWriteContractReturn,
  ReadContractsContract,
  ReadContractResult,
  UseReadContractsParams,
  UseReadContractsReturn,
} from './types';
