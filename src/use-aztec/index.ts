/**
 * use-aztec — Wallet-agnostic React hooks for Aztec contract interaction.
 *
 * Provides `useReadContract`, `useWriteContract`, and `useReadContracts` hooks
 * that work with any wallet implementation via the UseAztecProvider + config pattern.
 *
 * @example
 * ```tsx
 * import {
 *   UseAztecProvider,
 *   createUseAztecConfig,
 *   useReadContract,
 *   useWriteContract,
 * } from './use-aztec';
 *
 * // From aztec-wallet connector
 * const config = createUseAztecConfig({ connector, account, isConnected });
 *
 * <UseAztecProvider config={config}>
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
export { useAztec } from './context';

// =============================================================================
// CONFIG
// =============================================================================

export { createUseAztecConfig } from './config';

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
  // Config types
  UseAztecConfig,
  UseAztecConfigInput,
  UseAztecConnectorConfig,
  UseAztecAppManagedConfig,
  UseAztecBrowserWalletConfig,
  UseAztecLogger,
  FeePaymentMethodType,
  FeePaymentContractsConfig,
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
