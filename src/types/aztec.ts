import type { PXE } from '@aztec/pxe/server';
import type { Fr } from '@aztec/aztec.js/fields';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractInstanceWithAddress, ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { FunctionAbi, type ContractArtifact } from '@aztec/stdlib/abi';
import type { AzguardClient } from '@azguardwallet/client';
import type { 
  CaipAccount, 
  Operation, 
  SendTransactionOperation,
  SimulateViewsOperation,
  RegisterContractOperation,
  CallAction,
  AddPrivateAuthwitAction
} from '@azguardwallet/types';

// ============================================================================
// STORAGE SERVICE INTERFACES
// ============================================================================

export interface AccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
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

export interface IAztecWalletService {
  // Core initialization
  initialize(nodeUrl: string): Promise<void>;
  
  // PXE access
  getPXE(): PXE;
  
  // Account management
  connectTestAccount(index: number): Promise<AccountWithSecretKey>;
  createEcdsaAccount(deploy: boolean): Promise<CreateAccountResult>;
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
// AZGUARD WALLET INTERFACES
// ============================================================================

/**
 * Wallet type enumeration for different wallet implementations
 */
export enum WalletType {
  EMBEDDED = 'embedded',
  AZGUARD = 'azguard',
  TEST = 'test'
}

/**
 * Azguard wallet connection state
 */
export interface AzguardWalletState {
  isInstalled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  accounts: CaipAccount[];
  selectedAccount: CaipAccount | null;
  supportedChains: string[];
  error: string | null;
}

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
 * Azguard wallet service interface
 * Handles communication with Azguard wallet extension
 */
export interface IAzguardWalletService {
  // Core initialization
  initialize(): Promise<void>;
  
  // Wallet detection and connection
  isInstalled(): Promise<boolean>;
  connect(dappMetadata: any, permissions: any[]): Promise<CaipAccount[]>;
  disconnect(): Promise<void>;
  
  // Account management
  getAccounts(): Promise<CaipAccount[]>;
  getSelectedAccount(): CaipAccount | null;
  
  // Transaction operations
  sendTransaction(operation: SendTransactionOperation): Promise<string>;
  simulateViews(operation: SimulateViewsOperation): Promise<any>;
  registerContract(operation: RegisterContractOperation): Promise<void>;
  
  // Event handling
  onAccountsChanged(callback: (accounts: CaipAccount[]) => void): void;
  onDisconnected(callback: () => void): void;
  
  // Utility
  getSupportedChains(): string[];
}

/**
 * Universal wallet interface that can work with both embedded and Azguard wallets
 */
export interface IUniversalWallet {
  type: WalletType;
  isConnected: boolean;
  account: AccountWithSecretKey | null;
  
  // Common operations
  connect(): Promise<AccountWithSecretKey>;
  disconnect(): Promise<void>;
  
  // Transaction operations (abstracted)
  sendTransaction(params: unknown): Promise<string>;
  simulateCall(params: unknown): Promise<unknown>;
}

/**
 * Azguard-specific account data for storage
 */
export interface AzguardAccountData {
  caipAccount: CaipAccount;
  connectedAt: number;
  lastUsed: number;
}
