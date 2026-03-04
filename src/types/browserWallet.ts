/**
 * Browser wallet types.
 *
 * Re-exports operation types from use-aztec and defines app-specific
 * adapter interfaces and state types.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
} from '../use-aztec';
import type { ConnectionStatus } from './walletConnector';
import type { AztecNetwork } from '../config/networks/constants';

// Re-export operation types from use-aztec as the canonical source
export type {
  BrowserWalletOperationResult,
  BrowserWalletOperation,
  SimulateViewsOp,
  SendTransactionOp,
  GetTxReceiptOp,
  RegisterContractOp,
  ContractCall,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../use-aztec';

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
