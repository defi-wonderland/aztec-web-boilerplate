/**
 * Browser wallet adapter types.
 *
 * Defines the adapter interface and state types for browser wallet extensions.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
} from './browserWallet';
import type { ConnectionStatus } from './walletConnector';
import type { AztecNetwork } from '../../types/network';

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
