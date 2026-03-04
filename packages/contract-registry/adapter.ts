import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PXE } from '@aztec/pxe/server';

/**
 * Injection interface for wallet functionality.
 *
 * The contract registry module is wallet-agnostic — it receives all wallet
 * state through this adapter rather than importing wallet code directly.
 * The app layer creates a concrete adapter from useAztecWallet().
 */
export interface ContractRegistryWalletAdapter {
  isConnected: boolean;
  isPXEInitialized: boolean;
  account: unknown | null;
  walletType: string | null;
  isBrowserWallet: boolean;
  currentConfig: object;
  getPXE: () => PXE | null;
  getWallet: () => Wallet | null;
  queuePxeCall: <T>(op: () => Promise<T>) => Promise<T>;
}
