import { AzguardClient } from '@azguardwallet/client';
import type {
  CaipAccount,
  Operation,
  SendTransactionOperation,
  SimulateViewsOperation,
  RegisterContractOperation,
  OperationResult
} from '@azguardwallet/types';
import type {
  IAzguardWalletService,
  AzguardConnectionConfig,
  AzguardWalletState
} from '../../../types/azguard';

/**
 * Service class for interacting with Azguard wallet via RPC
 * Implements the IAzguardWalletService interface
 */
export class AzguardWalletService implements IAzguardWalletService {
  private client: AzguardClient | null = null;
  private state: AzguardWalletState = {
    isInstalled: false,
    isConnected: false,
    isConnecting: false,
    accounts: [],
    selectedAccount: null,
    supportedChains: [],
    error: null
  };
  private eventListeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize the Azguard wallet service
   */
  async initialize(): Promise<void> {
    try {
      // Check if Azguard wallet is installed
      const isInstalled = await AzguardClient.isAzguardInstalled();
      this.updateState({ isInstalled });

      if (isInstalled) {
        // Create the client instance
        this.client = await AzguardClient.create();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Get supported chains
        const supportedChains = this.getSupportedChains();
        this.updateState({ supportedChains });

        console.log('Azguard wallet service initialized successfully');
      } else {
        console.warn('⚠️ Azguard wallet is not installed');
        this.updateState({ 
          error: 'Azguard wallet extension is not installed. Please install it from the Chrome Web Store.' 
        });
      }
    } catch (error) {
      console.error('Failed to initialize Azguard wallet service:', error);
      this.updateState({ 
        error: error instanceof Error ? error.message : 'Failed to initialize Azguard wallet service' 
      });
      throw error;
    }
  }

  /**
   * Check if Azguard wallet is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      const isInstalled = await AzguardClient.isAzguardInstalled();
      this.updateState({ isInstalled });
      return isInstalled;
    } catch (error) {
      console.error('Error checking Azguard installation:', error);
      return false;
    }
  }

  /**
   * Connect to Azguard wallet
   */
  async connect(dappMetadata: any, permissions: any[]): Promise<CaipAccount[]> {
    if (!this.client) {
      throw new Error('Azguard wallet service not initialized');
    }

    try {
      this.updateState({ isConnecting: true, error: null });


      // Validate connection parameters
      this.validateConnectionParams(dappMetadata, permissions);

      // Connect to the wallet
      await this.client.connect(dappMetadata, permissions);

      // Get connected accounts
      const accounts = this.client.accounts;
      const selectedAccount = accounts.length > 0 ? accounts[0] : null;

      this.updateState({
        isConnected: true,
        isConnecting: false,
        accounts,
        selectedAccount
      });

      console.log('Connected to Azguard wallet:', { accounts, selectedAccount });
      return accounts;
    } catch (error) {
      console.error('Failed to connect to Azguard wallet:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      this.updateState({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Azguard wallet'
      });
      throw error;
    }
  }

  /**
   * Validate connection parameters before attempting connection
   */
  private validateConnectionParams(dappMetadata: any, permissions: any[]): void {
    // Validate dappMetadata
    if (!dappMetadata || typeof dappMetadata !== 'object') {
      throw new Error('dappMetadata is required and must be an object');
    }

    if (!dappMetadata.name || typeof dappMetadata.name !== 'string') {
      throw new Error('dappMetadata.name is required and must be a string');
    }

    if (dappMetadata.url && typeof dappMetadata.url !== 'string') {
      throw new Error('dappMetadata.url must be a string if provided');
    }

    if (dappMetadata.icon && typeof dappMetadata.icon !== 'string') {
      throw new Error('dappMetadata.icon must be a string if provided');
    }

    // Validate permissions
    if (!Array.isArray(permissions)) {
      throw new Error('permissions must be an array');
    }

    if (permissions.length === 0) {
      throw new Error('permissions array cannot be empty');
    }

    permissions.forEach((permission, index) => {
      if (!permission || typeof permission !== 'object') {
        throw new Error(`permissions[${index}] must be an object`);
      }

      if (!Array.isArray(permission.chains)) {
        throw new Error(`permissions[${index}].chains must be an array`);
      }

      if (permission.chains.length === 0) {
        throw new Error(`permissions[${index}].chains cannot be empty`);
      }

      if (!Array.isArray(permission.methods)) {
        throw new Error(`permissions[${index}].methods must be an array`);
      }

      if (permission.methods.length === 0) {
        throw new Error(`permissions[${index}].methods cannot be empty`);
      }

      // Validate chain format (should be like "aztec:31337")
      permission.chains.forEach((chain: any, chainIndex: number) => {
        if (typeof chain !== 'string') {
          throw new Error(`permissions[${index}].chains[${chainIndex}] must be a string`);
        }
        if (!chain.startsWith('aztec:')) {
          throw new Error(`permissions[${index}].chains[${chainIndex}] must start with "aztec:"`);
        }
      });

      // Validate method names
      permission.methods.forEach((method: any, methodIndex: number) => {
        if (typeof method !== 'string') {
          throw new Error(`permissions[${index}].methods[${methodIndex}] must be a string`);
        }
      });
    });

  }

  /**
   * Disconnect from Azguard wallet
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.disconnect();
      
      this.updateState({
        isConnected: false,
        accounts: [],
        selectedAccount: null,
        error: null
      });

      console.log('Disconnected from Azguard wallet');
    } catch (error) {
      console.error('Failed to disconnect from Azguard wallet:', error);
      throw error;
    }
  }

  /**
   * Get connected accounts
   */
  async getAccounts(): Promise<CaipAccount[]> {
    if (!this.client || !this.state.isConnected) {
      return [];
    }

    try {
      const accounts = this.client.accounts;
      this.updateState({ accounts });
      return accounts;
    } catch (error) {
      console.error('❌ Failed to get accounts:', error);
      return [];
    }
  }

  /**
   * Get currently selected account
   */
  getSelectedAccount(): CaipAccount | null {
    return this.state.selectedAccount;
  }

  /**
   * Send transaction through Azguard wallet
   */
  async sendTransaction(operation: SendTransactionOperation): Promise<string> {
    if (!this.client || !this.state.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const [result] = await this.client.execute([operation]);
      
      if (result.status !== 'ok') {
        const errorMessage = 'error' in result ? result.error : 'Transaction failed';
        throw new Error(errorMessage || 'Transaction failed');
      }

      console.log('Transaction sent successfully:', result.result);
      return result.result as string;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    }
  }

  /**
   * Simulate view functions
   */
  async simulateViews(operation: SimulateViewsOperation): Promise<unknown> {
    if (!this.client || !this.state.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const [result] = await this.client.execute([operation]);
      
      if (result.status !== 'ok') {
        const errorMessage = 'error' in result ? result.error : 'Simulation failed';
        throw new Error(errorMessage || 'Simulation failed');
      }

      console.log('✅ View simulation completed:', result.result);
      return result.result;
    } catch (error) {
      console.error('❌ Failed to simulate views:', error);
      throw error;
    }
  }

  /**
   * Register contract with Azguard wallet
   */
  async registerContract(operation: RegisterContractOperation): Promise<void> {
    if (!this.client || !this.state.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const [result] = await this.client.execute([operation]);
      
      if (result.status !== 'ok') {
        const errorMessage = 'error' in result ? result.error : 'Contract registration failed';
        throw new Error(errorMessage || 'Contract registration failed');
      }

      console.log('✅ Contract registered successfully');
    } catch (error) {
      console.error('❌ Failed to register contract:', error);
      throw error;
    }
  }

  /**
   * Execute multiple operations in batch
   */
  async executeOperations(operations: Operation[]): Promise<OperationResult[]> {
    if (!this.client || !this.state.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const results = await this.client.execute(operations);
      console.log('✅ Batch operations completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Failed to execute operations:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for wallet events
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // Listen for account changes
    this.client.onDisconnected.addHandler(() => {
      this.updateState({
        isConnected: false,
        accounts: [],
        selectedAccount: null
      });
      this.emitEvent('disconnected');
    });

    // Note: Azguard client doesn't expose account change events directly
    // We'll need to poll or handle this differently if needed
  }

  /**
   * Add event listener
   */
  onAccountsChanged(callback: (accounts: CaipAccount[]) => void): void {
    this.addEventListener('accountsChanged', callback);
  }

  /**
   * Add disconnection event listener
   */
  onDisconnected(callback: () => void): void {
    this.addEventListener('disconnected', callback);
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): string[] {
    // Azguard supports these Aztec chains
    return [
      'aztec:31337',    // Sandbox
      'aztec:11155111', // Testnet
      'aztec:1337'      // Devnet
    ];
  }

  /**
   * Get current wallet state
   */
  getState(): AzguardWalletState {
    return { ...this.state };
  }

  /**
   * Get the underlying AzguardClient instance
   */
  getClient(): AzguardClient | null {
    return this.client;
  }

  /**
   * Update wallet state and notify listeners
   */
  private updateState(updates: Partial<AzguardWalletState>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Emit account changes if accounts changed
    if (updates.accounts && JSON.stringify(previousState.accounts) !== JSON.stringify(updates.accounts)) {
      this.emitEvent('accountsChanged', updates.accounts);
    }
  }

  /**
   * Add event listener
   */
  private addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.eventListeners.clear();
    this.client = null;
    this.state = {
      isInstalled: false,
      isConnected: false,
      isConnecting: false,
      accounts: [],
      selectedAccount: null,
      supportedChains: [],
      error: null
    };
  }
}
