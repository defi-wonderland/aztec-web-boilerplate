/**
 * use-aztec Configuration Types
 *
 * Defines the config interfaces for the use-aztec module.
 * Supports three input shapes: aztec-wallet connector, custom app-managed PXE,
 * and custom browser wallet — all resolved into a single UseAztecConfig.
 */

import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../../types/browserWallet';
import type { WalletConnector } from '../../types/walletConnector';

// =============================================================================
// Fee Payment
// =============================================================================

/** Fee payment method type identifier. */
export type FeePaymentMethodType = 'sponsored' | 'metered' | 'meteredExact';

/** Fee payment contracts config — map of contract names to deployment details. */
export type FeePaymentContractsConfig = Record<
  string,
  { address?: string; salt?: string; deployer?: string }
>;

// =============================================================================
// Logger
// =============================================================================

/** Pluggable logger interface for use-aztec hooks. */
export interface UseAztecLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/** Default logger is silent to avoid noisy library output. */
export const DEFAULT_LOGGER: UseAztecLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

// =============================================================================
// Execution Parameter Types (passed to core functions)
// =============================================================================

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
  feePaymentMethod?: FeePaymentMethodType;
  timeout?: number;
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}

/** Data returned from a successful write operation. */
export interface WriteContractData {
  txHash?: string;
  result?: unknown;
}

// =============================================================================
// Resolved Config (what context holds)
// =============================================================================

/** The resolved use-aztec config held in React context. */
export interface UseAztecConfig {
  isConnected: boolean;
  account: AccountWithSecretKey | null;
  executeRead: (params: ReadExecutionParams) => Promise<unknown>;
  executeBatchRead: (
    params: BatchReadExecutionParams
  ) => Promise<BatchReadResult[] | unknown[]>;
  executeWrite: (params: WriteExecutionParams) => Promise<WriteContractData>;
  logger: UseAztecLogger;
}

// =============================================================================
// Config Input Shapes
// =============================================================================

/** Config input for aztec-wallet connector users (convenience). */
export interface UseAztecConnectorConfig {
  connector: WalletConnector | null;
  account: AccountWithSecretKey | null;
  isConnected: boolean;
  feePaymentConfig?: FeePaymentContractsConfig;
  defaultFeePaymentMethod?: FeePaymentMethodType;
  logger?: UseAztecLogger;
}

/** Config input for custom app-managed PXE. */
export interface UseAztecAppManagedConfig {
  mode: 'app_managed';
  getWallet: () => Wallet | null;
  account: AccountWithSecretKey | null;
  isConnected: boolean;
  createFeePaymentMethod: (
    type: FeePaymentMethodType
  ) => Promise<FeePaymentMethod>;
  defaultFeePaymentMethod?: FeePaymentMethodType;
  logger?: UseAztecLogger;
}

/** Config input for custom browser wallet. */
export interface UseAztecBrowserWalletConfig {
  mode: 'browser_wallet';
  account: AccountWithSecretKey | null;
  isConnected: boolean;
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
  sendTransaction: (
    request: ConnectorTransactionRequest
  ) => Promise<ConnectorTransactionResult>;
  getCaipAccount: () => string | null;
  logger?: UseAztecLogger;
}

/** Union of all supported config input shapes. */
export type UseAztecConfigInput =
  | UseAztecConnectorConfig
  | UseAztecAppManagedConfig
  | UseAztecBrowserWalletConfig;
