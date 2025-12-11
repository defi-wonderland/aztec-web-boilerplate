import type { PXE } from '@aztec/pxe/server';
import type { Fr } from '@aztec/aztec.js/fields';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { FunctionAbi, type ContractArtifact } from '@aztec/stdlib/abi';
import type { CaipAccount, Operation } from '@azguardwallet/types';

// ============================================================================
// STORAGE SERVICE INTERFACES
// ============================================================================

export interface AccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
  evmAddress?: string; // Links account to EVM wallet identity
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

export interface IAztecWalletService {
  // Core initialization
  initialize(nodeUrl: string): Promise<void>;

  // PXE access
  getPXE(): PXE;

  // Account management
  connectTestAccount(index: number): Promise<AccountWithSecretKey>;
  createEcdsaAccount(
    credentials?: AccountCredentials
  ): Promise<CreateAccountResult>;
  createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<AccountWithSecretKey>;

  // Payment methods (public API)
  getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod>;
}

// ============================================================================
// CONTRACT SERVICE INTERFACES
// ============================================================================

export interface IAztecContractService {
  registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs?: any[],
    constructor?: FunctionAbi | string
  ): Promise<ContractInstanceWithAddress>;
}

// ============================================================================
// WALLET TYPE DEFINITIONS
// ============================================================================

/**
 * Wallet type enumeration for different wallet implementations
 *
 * - EMBEDDED: App manages PXE + internal signing (keys stored in app)
 * - EXTERNAL_SIGNER: App manages PXE + external signing (MetaMask, WalletConnect, Ledger)
 * - BROWSER_WALLET: External PXE + external signing (Azguard extension)
 */
export enum WalletType {
  EMBEDDED = 'embedded',
  EXTERNAL_SIGNER = 'external',
  BROWSER_WALLET = 'browser',
}

/**
 * External signer types for wallets that delegate signing to external wallets
 * while the app manages the PXE connection
 */
export enum ExternalSignerType {
  METAMASK = 'metamask',
  // Future possible signers:
  // WALLET_CONNECT = 'walletconnect',
}

// ============================================================================
// AZGUARD WALLET INTERFACES
// ============================================================================

/**
 * Azguard account adapter interface
 * Bridges between CAIP account format and AccountWithSecretKey interface
 */
export interface IAzguardAccountAdapter {
  /**
   * Convert CAIP account to AccountWithSecretKey-compatible interface
   */
  toAccountWallet(caipAccount: CaipAccount): Promise<AccountWithSecretKey>;

  /**
   * Get the Aztec address from CAIP account
   */
  getAztecAddress(caipAccount: CaipAccount): AztecAddress;

  /**
   * Execute Azguard-specific operations
   */
  executeOperation(operation: Operation): Promise<unknown>;

  /**
   * Check if account is deployed on the network
   */
  isAccountDeployed(caipAccount: CaipAccount): Promise<boolean>;
}

/**
 * Azguard-specific account data for storage
 */
export interface AzguardAccountData {
  caipAccount: CaipAccount;
  connectedAt: number;
  lastUsed: number;
}
