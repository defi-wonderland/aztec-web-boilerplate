import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { ConnectionStatus } from './walletConnector';
import type { AztecNetwork } from '../config/networks/constants';

/**
 * Generic state for any browser wallet extension.
 */
export interface BrowserWalletState {
  isInstalled: boolean;
  status: ConnectionStatus;
  accounts: string[];
  selectedAccount: string | null;
  supportedChains: string[];
  error: string | null;
}

/**
 * Generic operation result from browser wallet.
 */
export interface BrowserWalletOperationResult {
  status: 'ok' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

/**
 * A single action within a connector transaction request.
 */
export interface ConnectorTransactionAction {
  contract: string;
  method: string;
  args: unknown[];
}

/**
 * Request to send a transaction via a connector.
 */
export interface ConnectorTransactionRequest {
  actions: ConnectorTransactionAction[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of a connector transaction.
 */
export interface ConnectorTransactionResult {
  status: 'success' | 'failed';
  txHash?: string;
  error?: string;
  rawResult?: unknown;
}

// ============================================================================
// Generic Operations (wallet-agnostic)
// ============================================================================

/**
 * A single contract call within an operation.
 */
export interface ContractCall {
  kind: 'call';
  contract: string;
  method: string;
  args: unknown[];
}

/**
 * Simulate view functions without sending a transaction.
 */
export interface SimulateViewsOp {
  kind: 'simulate_views';
  account: string;
  calls: ContractCall[];
}

/**
 * Send a transaction to the network.
 */
export interface SendTransactionOp {
  kind: 'send_transaction';
  account: string;
  chain: string;
  calls: ContractCall[];
}

/**
 * Get a transaction receipt by hash.
 */
export interface GetTxReceiptOp {
  kind: 'aztec_getTxReceipt';
  chain: string;
  txHash: string;
}

/**
 * Register a contract with the browser wallet.
 * Note: The instance/artifact structure may vary by wallet implementation.
 */
export interface RegisterContractOp {
  kind: 'register_contract';
  chain: string;
  address: string;
  instance: unknown;
  artifact: unknown;
}

/**
 * Union of all supported browser wallet operations.
 */
export type BrowserWalletOperation =
  | SimulateViewsOp
  | SendTransactionOp
  | GetTxReceiptOp
  | RegisterContractOp;

/**
 * Interface that any browser wallet adapter must implement.
 * This allows adding new browser wallets (Azguard, Obsidian, etc.)
 * by simply implementing this interface.
 */
export interface IBrowserWalletAdapter {
  readonly id: string;
  readonly label: string;

  initialize(): Promise<void>;
  destroy(): void;

  getState(): BrowserWalletState;

  connect(networkName: AztecNetwork): Promise<string[]>;
  disconnect(): Promise<void>;

  executeOperations(
    ops: BrowserWalletOperation[]
  ): Promise<BrowserWalletOperationResult[]>;
  toAccountWallet(accountId: string): Promise<AccountWithSecretKey>;

  onAccountsChanged(cb: (accounts: string[]) => void): void;
  onDisconnected(cb: () => void): void;
}

/**
 * Factory function type for creating browser wallet adapters.
 * Returns a Promise to support async dynamic imports.
 */
export type BrowserWalletAdapterFactory = () => Promise<IBrowserWalletAdapter>;

/**
 * Default state for browser wallets.
 */
export const DEFAULT_BROWSER_WALLET_STATE: BrowserWalletState = {
  isInstalled: false,
  status: 'disconnected',
  accounts: [],
  selectedAccount: null,
  supportedChains: [],
  error: null,
};
