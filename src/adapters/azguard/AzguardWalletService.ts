import { AzguardClient } from '@azguardwallet/client';
import type {
  CaipAccount,
  Operation,
  OperationResult,
} from '@azguardwallet/types';
import type { AzguardWalletState } from '../../types/azguard';
import { SUPPORTED_CHAINS } from '../../config/networks/constants';

export class AzguardWalletService {
  private client: AzguardClient | null = null;
  private state: AzguardWalletState = {
    isInstalled: false,
    status: 'disconnected',
    accounts: [],
    selectedAccount: null,
    supportedChains: [],
    error: null,
  };
  private eventListeners: Map<string, Set<Function>> = new Map();
  private accountsChangedHandler?: (accounts: CaipAccount[]) => void;
  private disconnectedHandler?: () => void;

  async initialize(): Promise<void> {
    try {
      const isInstalled = await AzguardClient.isAzguardInstalled();
      this.updateState({ isInstalled });

      if (isInstalled) {
        this.client = await AzguardClient.create();

        this.setupEventListeners();

        const supportedChains = this.getSupportedChains();
        this.updateState({ supportedChains });

        console.log('Azguard wallet service initialized successfully');
      } else {
        console.warn('⚠️ Azguard wallet is not installed');
        this.updateState({
          error:
            'Azguard wallet extension is not installed. Please install it from the Chrome Web Store.',
        });
      }
    } catch (error) {
      console.error('Failed to initialize Azguard wallet service:', error);
      this.updateState({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize Azguard wallet service',
      });
      throw error;
    }
  }

  /**
   * Connect to Azguard wallet
   */
  async connect(
    dappMetadata: any,
    requiredPermissions: any[],
    optionalPermissions?: any[]
  ): Promise<CaipAccount[]> {
    if (!this.client) {
      throw new Error('Azguard wallet service not initialized');
    }

    try {
      this.updateState({ status: 'connecting', error: null });

      // Validate connection parameters
      this.validateConnectionParams(
        dappMetadata,
        requiredPermissions,
        optionalPermissions
      );

      // Connect to the wallet with required and optional permissions
      if (optionalPermissions && optionalPermissions.length > 0) {
        await this.client.connect(
          dappMetadata,
          requiredPermissions,
          optionalPermissions
        );
      } else {
        await this.client.connect(dappMetadata, requiredPermissions);
      }

      // Get connected accounts
      const accounts = this.client.accounts;
      const selectedAccount = accounts.length > 0 ? accounts[0] : null;

      this.updateState({
        status: 'connected',
        accounts,
        selectedAccount,
      });

      console.log('Connected to Azguard wallet:', {
        accounts,
        selectedAccount,
      });
      return accounts;
    } catch (error) {
      console.error('Failed to connect to Azguard wallet:', error);

      // Enhanced error logging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }

      this.updateState({
        status: 'disconnected',
        error:
          error instanceof Error
            ? error.message
            : 'Failed to connect to Azguard wallet',
      });
      throw error;
    }
  }

  /**
   * Validate connection parameters before attempting connection
   */
  private validateConnectionParams(
    dappMetadata: any,
    requiredPermissions: any[],
    optionalPermissions?: any[]
  ): void {
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

    const validatePermissions = (permissions: any[], label: string) => {
      if (!Array.isArray(permissions)) {
        throw new Error(`${label} must be an array`);
      }

      if (permissions.length === 0) {
        throw new Error(`${label} array cannot be empty`);
      }

      permissions.forEach((permission, index) => {
        if (!permission || typeof permission !== 'object') {
          throw new Error(`${label}[${index}] must be an object`);
        }

        if (!Array.isArray(permission.chains)) {
          throw new Error(`${label}[${index}].chains must be an array`);
        }

        if (permission.chains.length === 0) {
          throw new Error(`${label}[${index}].chains cannot be empty`);
        }

        if (!Array.isArray(permission.methods)) {
          throw new Error(`${label}[${index}].methods must be an array`);
        }

        if (permission.methods.length === 0) {
          throw new Error(`${label}[${index}].methods cannot be empty`);
        }

        permission.chains.forEach((chain: any, chainIndex: number) => {
          if (typeof chain !== 'string') {
            throw new Error(
              `${label}[${index}].chains[${chainIndex}] must be a string`
            );
          }
          if (!chain.startsWith('aztec:')) {
            throw new Error(
              `${label}[${index}].chains[${chainIndex}] must start with "aztec:"`
            );
          }
        });

        permission.methods.forEach((method: any, methodIndex: number) => {
          if (typeof method !== 'string') {
            throw new Error(
              `${label}[${index}].methods[${methodIndex}] must be a string`
            );
          }
        });
      });
    };

    validatePermissions(requiredPermissions, 'requiredPermissions');

    if (optionalPermissions && optionalPermissions.length > 0) {
      validatePermissions(optionalPermissions, 'optionalPermissions');
    }
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
        status: 'disconnected',
        accounts: [],
        selectedAccount: null,
        error: null,
      });

      console.log('Disconnected from Azguard wallet');
    } catch (error) {
      console.error('Failed to disconnect from Azguard wallet:', error);
      throw error;
    }
  }

  /**
   * Execute multiple operations in batch
   */
  async executeOperations(operations: Operation[]): Promise<OperationResult[]> {
    if (!this.client || this.state.status !== 'connected') {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const results = await this.client.execute(operations);

      // Log individual operation results
      const succeeded = results.filter((r) => r.status === 'ok').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;

      console.log(
        `📋 Batch operations completed: ${succeeded} ok, ${failed} failed, ${skipped} skipped`
      );

      // Log details for failed operations
      results.forEach((result, index) => {
        if (result.status === 'failed') {
          const errorMsg = 'error' in result ? result.error : 'Unknown error';
          console.error(`❌ Operation ${index} failed:`, errorMsg);
        } else if (result.status === 'skipped') {
          console.warn(`⏭️ Operation ${index} skipped`);
        }
      });

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

    this.accountsChangedHandler = (accounts: CaipAccount[]) => {
      this.updateState({
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null,
        status: accounts.length > 0 ? 'connected' : 'disconnected',
      });
    };

    this.disconnectedHandler = () => {
      this.updateState({
        status: 'disconnected',
        accounts: [],
        selectedAccount: null,
      });
      this.emitEvent('disconnected');
    };

    this.client.onAccountsChanged.addHandler(this.accountsChangedHandler);
    this.client.onDisconnected.addHandler(this.disconnectedHandler);
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

  getSupportedChains(): string[] {
    return [...SUPPORTED_CHAINS];
  }

  /**
   * Get the underlying Azguard client
   */
  getClient(): AzguardClient | null {
    return this.client;
  }

  /**
   * Get current wallet state
   */
  getState(): AzguardWalletState {
    return { ...this.state };
  }

  /**
   * Update wallet state and notify listeners
   */
  private updateState(updates: Partial<AzguardWalletState>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Emit account changes if accounts changed
    if (
      updates.accounts &&
      JSON.stringify(previousState.accounts) !==
        JSON.stringify(updates.accounts)
    ) {
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
      listeners.forEach((callback) => {
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
    if (this.client) {
      if (this.accountsChangedHandler) {
        this.client.onAccountsChanged.removeHandler(
          this.accountsChangedHandler
        );
      }
      if (this.disconnectedHandler) {
        this.client.onDisconnected.removeHandler(this.disconnectedHandler);
      }
    }
    this.accountsChangedHandler = undefined;
    this.disconnectedHandler = undefined;
    this.eventListeners.clear();
    this.client = null;
    this.state = {
      isInstalled: false,
      status: 'disconnected',
      accounts: [],
      selectedAccount: null,
      supportedChains: [],
      error: null,
    };
  }
}
