import { type PXE, type AccountWallet, type Fr, type ContractFunctionInteraction, type AztecAddress, type ContractInstanceWithAddress } from '@aztec/aztec.js';
import { FunctionAbi, type ContractArtifact } from '@aztec/stdlib/abi';
import { type SponsoredFeePaymentMethod } from '@aztec/aztec.js';
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
  account: any; // TODO: Type this properly when we know the exact type
  wallet: AccountWallet;
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
  connectTestAccount(index: number): Promise<AccountWallet>;
  createEcdsaAccount(deploy: boolean): Promise<CreateAccountResult>;
  createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<AccountWallet>;
  
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
// VOTING SERVICE INTERFACES
// ============================================================================

export interface IAztecVotingService {
  castVote(candidateId: number): Promise<void>;
  getVoteCount(candidateId: number): Promise<number>;
  getAllVoteCounts(): Promise<{ [key: number]: number }>;
}

// ============================================================================
// DRIPPER SERVICE INTERFACES
// ============================================================================

export interface IDripperService {
  dripToPrivate(tokenAddress: string, amount: bigint): Promise<void>;
  dripToPublic(tokenAddress: string, amount: bigint): Promise<void>;
  syncPrivateState(): Promise<void>;
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
 * Bridges between CAIP account format and AccountWallet interface
 */
export interface IAzguardAccountAdapter {
  /**
   * Convert CAIP account to AccountWallet-compatible interface
   */
  toAccountWallet(caipAccount: CaipAccount): Promise<AccountWallet>;
  
  /**
   * Get the Aztec address from CAIP account
   */
  getAztecAddress(caipAccount: CaipAccount): AztecAddress;
  
  /**
   * Execute Azguard-specific operations
   */
  executeOperation(operation: Operation): Promise<any>;
  
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
  account: AccountWallet | null;
  
  // Common operations
  connect(): Promise<AccountWallet>;
  disconnect(): Promise<void>;
  
  // Transaction operations (abstracted)
  sendTransaction(params: any): Promise<string>;
  simulateCall(params: any): Promise<any>;
}

/**
 * Azguard-specific account data for storage
 */
export interface AzguardAccountData {
  caipAccount: CaipAccount;
  connectedAt: number;
  lastUsed: number;
}
