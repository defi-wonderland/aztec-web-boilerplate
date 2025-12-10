import type { AzguardClient } from '@azguardwallet/client';
import type { 
  CaipAccount, 
  Operation, 
  SendTransactionOperation,
  SimulateViewsOperation,
  RegisterContractOperation,
  OperationResult
} from '@azguardwallet/types';

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
  requiredPermissions: Array<{
    chains: string[];
    methods: string[];
  }>;
  optionalPermissions?: Array<{
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
 * Azguard wallet service interface
 * Handles communication with Azguard wallet extension
 */
export interface IAzguardWalletService {
  // Core initialization
  initialize(): Promise<void>;
  
  // Wallet detection and connection
  isInstalled(): Promise<boolean>;
  connect(
    dappMetadata: AzguardConnectionConfig['dappMetadata'],
    requiredPermissions: AzguardConnectionConfig['requiredPermissions'],
    optionalPermissions?: AzguardConnectionConfig['optionalPermissions']
  ): Promise<CaipAccount[]>;
  disconnect(): Promise<void>;
  
  // Account management
  getAccounts(): Promise<CaipAccount[]>;
  getSelectedAccount(): CaipAccount | null;
  
  // Transaction operations
  sendTransaction(operation: SendTransactionOperation): Promise<string>;
  simulateViews(operation: SimulateViewsOperation): Promise<unknown>;
  registerContract(operation: RegisterContractOperation): Promise<void>;
  
  // Batch operations
  executeOperations(operations: Operation[]): Promise<OperationResult[]>;
  
  // Event handling
  onAccountsChanged(callback: (accounts: CaipAccount[]) => void): void;
  onDisconnected(callback: () => void): void;
  
  // Utility
  getSupportedChains(): string[];
  getState(): AzguardWalletState;
  getClient(): AzguardClient | null;
  destroy(): void;
}
