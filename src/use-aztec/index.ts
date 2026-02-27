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
export { AztecClientNotReadyError } from './errors';

// =============================================================================
// HOOKS
// =============================================================================

export { useReadContract } from './hooks';
export { useWriteContract } from './hooks';
export { useReadContracts } from './hooks';
export { useAztecClient } from './hooks';

// =============================================================================
// ACTIONS
// =============================================================================

export { writeContract } from './actions';
export { readContract } from './actions';
export { readContracts } from './actions';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Runtime execution types
  AztecExecutionClient,
  ReadExecutionParams,
  BatchReadExecutionParams,
  BatchReadContract,
  WriteExecutionParams,
  // Action param types
  ReadContractActionParams,
  ReadContractsActionParams,
  // Contract types (re-exported from contractTypes.ts)
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
} from './types';
