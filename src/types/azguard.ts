import type { AzguardClient } from '@azguardwallet/client';
import type { 
  CaipAccount, 
  Operation, 
  SendTransactionOperation,
  SimulateViewsOperation,
  RegisterContractOperation,
  CallAction,
  AddPrivateAuthwitAction,
  OperationResult
} from '@azguardwallet/types';
import { type AccountWallet } from '@aztec/aztec.js';

// ============================================================================
// AZGUARD WALLET TYPES
// ============================================================================

/**
 * Azguard wallet connection configuration
 */
export interface AzguardConnectionConfig {
  dappMetadata: {
    name: string;
    description?: string;
    url?: string;
    icon?: string;
  };
  permissions: Array<{
    chains: string[];
    methods: string[];
  }>;
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
 * Azguard wallet context type for React provider
 */
export interface AzguardWalletContextType {
  // State
  state: AzguardWalletState;
  client: AzguardClient | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchAccount: (account: CaipAccount) => Promise<void>;
  
  // Operations
  executeOperations: (operations: Operation[]) => Promise<OperationResult[]>;
  
  // Utility
  isAccountDeployed: (account: CaipAccount) => Promise<boolean>;
  getAccountWallet: (account: CaipAccount) => Promise<AccountWallet>;
}

/**
 * Azguard operation builder helpers
 */
export interface AzguardOperationBuilder {
  buildSendTransaction(
    account: CaipAccount,
    actions: Array<CallAction | AddPrivateAuthwitAction>
  ): SendTransactionOperation;
  
  buildSimulateViews(
    account: CaipAccount,
    calls: CallAction[]
  ): SimulateViewsOperation;
  
  buildRegisterContract(
    chain: string,
    address: string,
    instance: any,
    artifact: any
  ): RegisterContractOperation;
}

/**
 * Azguard wallet error types
 */
export interface AzguardWalletError extends Error {
  code?: string;
  data?: any;
}

// Re-export commonly used Azguard types
export type {
  AzguardClient,
  CaipAccount,
  Operation,
  SendTransactionOperation,
  SimulateViewsOperation,
  RegisterContractOperation,
  CallAction,
  AddPrivateAuthwitAction,
  OperationResult
};
