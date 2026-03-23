import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Fr } from '@aztec/aztec.js/fields';
import type { CaipAccount } from '@azguardwallet/types';

// ============================================================================
// STORAGE SERVICE INTERFACES
// ============================================================================

export interface AccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
  evmAddress?: string;
}

export interface IAztecStorageService {
  saveAccount(accountData: AccountData): void;
  getAccount(): AccountData | null;
  clearAccount(): void;
  saveSenders(senders: string[]): void;
  getSenders(): string[];
  addSender(sender: string): void;
  removeSender(sender: string): void;
  clearSenders(): void;
}

// ============================================================================
// WALLET SERVICE INTERFACES
// ============================================================================

export interface CreateAccountResult {
  account: unknown;
  wallet: AccountWithSecretKey;
  salt: Fr;
  secretKey: Fr;
  signingKey: Buffer; // Node.js Buffer type
}

export interface AccountCredentials {
  secretKey: Fr;
  signingKey: Buffer;
  salt: Fr;
}

// ============================================================================
// WALLET TYPE DEFINITIONS
// ============================================================================

/**
 * Wallet type enumeration for different wallet implementations
 *
 * - EMBEDDED: App manages PXE + internal signing (keys stored in app)
 * - BROWSER_WALLET: External PXE + external signing (Azguard extension)
 */
export enum WalletType {
  EMBEDDED = 'embedded',
  EXTERNAL_SIGNER = 'external',
  BROWSER_WALLET = 'browser',
}

/**
 * Wallet type for connect modal UI
 *
 * Used in the connect modal to categorize wallet options:
 * - 'embedded': Built-in wallet with keys stored in the app
 * - 'aztec': Native Aztec browser wallets (e.g., Azguard)
 */
export type ModalWalletType = 'embedded' | 'aztec';

// ============================================================================
// AZGUARD WALLET INTERFACES
// ============================================================================

/**
 * Azguard-specific account data for storage
 */
export interface AzguardAccountData {
  caipAccount: CaipAccount;
  connectedAt: number;
  lastUsed: number;
}
