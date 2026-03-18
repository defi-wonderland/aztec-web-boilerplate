/**
 * Browser wallet operation types for aztec-wallet.
 *
 * These types define the protocol for communicating with browser wallet
 * extensions. They are intentionally kept minimal and wallet-agnostic.
 */

/**
 * Generic operation result from browser wallet.
 */
export interface BrowserWalletOperationResult {
  status: 'ok' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

/**
 * A single contract call within an operation.
 */
export interface ContractCall {
  kind: 'call';
  contract: string;
  method: string;
  args: readonly unknown[];
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
  /** The CAIP-2 chain used when the transaction was submitted. */
  chain?: string;
  error?: string;
  rawResult?: unknown;
}
