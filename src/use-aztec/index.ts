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
// =============================================================================
// HOOKS
// =============================================================================

export { useReadContract } from './hooks';
export { useWriteContract } from './hooks';
export { useReadContracts } from './hooks';
export { useAztecClient } from './hooks';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Contract types
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
  ReadContractsContract,
  ReadContractResult,
  UseReadContractsParams,
  // Execution client types
  AztecExecutionClient,
  BatchReadResult,
  ReadExecutionParams,
  BatchReadExecutionParams,
  WriteExecutionParams,
} from './types';
