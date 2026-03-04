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
export { AztecClientNotReady } from './errors';

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
  WriteExecutionParams,
  // Action param types
  ReadContractActionParams,
  ReadContractsActionParams,
  WriteContractActionParams,
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
  DynamicReadContractConfig,
  DynamicWriteContractConfig,
  // Browser wallet operation types
  BrowserWalletOperationResult,
  BrowserWalletOperation,
  SimulateViewsOp,
  SendTransactionOp,
  GetTxReceiptOp,
  RegisterContractOp,
  ContractCall,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from './types';
