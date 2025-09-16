/**
 * Azguard Wallet Provider
 * React context provider for Azguard wallet integration
 */

import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet } from '@aztec/aztec.js';
import type {
  AzguardWalletContextType,
  AzguardWalletState,
  AzguardConnectionConfig,
  CaipAccount,
  OperationResult,
  Operation
} from '../types/azguard';
import { AzguardWalletService } from '../services/aztec/wallet/AzguardWalletService';
import { AzguardAccountAdapter } from '../services/aztec/wallet/AzguardAccountAdapter';
import { useAsyncOperation } from '../hooks';
import { useError } from './ErrorProvider';

// Create the context
export const AzguardWalletContext = createContext<AzguardWalletContextType | undefined>(undefined);

interface AzguardWalletProviderProps {
  children: ReactNode;
}

/**
 * Azguard Wallet Provider Component
 */
export const AzguardWalletProvider: React.FC<AzguardWalletProviderProps> = ({ children }) => {
  // State management
  const [state, setState] = useState<AzguardWalletState>({
    isInstalled: false,
    isConnected: false,
    isConnecting: false,
    accounts: [],
    selectedAccount: null,
    supportedChains: [],
    error: null
  });

  // Service references
  const azguardServiceRef = useRef<AzguardWalletService | null>(null);
  const accountAdapterRef = useRef<AzguardAccountAdapter | null>(null);
  const isInitializedRef = useRef(false);

  // Hooks
  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { addMessage } = useError();

  // Initialize services on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      initializeServices();
      isInitializedRef.current = true;
    }

    // Cleanup on unmount
    return () => {
      if (azguardServiceRef.current) {
        azguardServiceRef.current.destroy();
      }
      if (accountAdapterRef.current) {
        accountAdapterRef.current.destroy();
      }
    };
  }, []);

  /**
   * Initialize Azguard services
   */
  const initializeServices = async (): Promise<void> => {
    try {
      // Create service instances
      const azguardService = new AzguardWalletService();
      const accountAdapter = new AzguardAccountAdapter(azguardService);

      // Store references
      azguardServiceRef.current = azguardService;
      accountAdapterRef.current = accountAdapter;

      // Initialize the service
      await azguardService.initialize();

      // Update state with initial service state
      const serviceState = azguardService.getState();
      setState(serviceState);

      // Set up event listeners
      setupEventListeners(azguardService);

      console.log('✅ Azguard wallet provider initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Azguard wallet provider:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize Azguard wallet'
      }));
    }
  };

  /**
   * Set up event listeners for wallet events
   */
  const setupEventListeners = (service: AzguardWalletService): void => {
    // Listen for account changes
    service.onAccountsChanged((accounts: CaipAccount[]) => {
      setState(prev => ({
        ...prev,
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null
      }));
    });

    // Listen for disconnection
    service.onDisconnected(() => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null
      }));
      
      addMessage({
        message: 'Azguard wallet disconnected',
        type: 'info',
        source: 'azguard'
      });
    });
  };

  /**
   * Connect to Azguard wallet
   */
  const connect = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!azguardServiceRef.current) {
        throw new Error('Azguard service not initialized');
      }

      // Get supported chains from the service
      const supportedChains = azguardServiceRef.current.getSupportedChains();
      console.log('🔗 Supported chains from Azguard:', supportedChains);

      // Default connection configuration - following Azguard wallet specification
      const config: AzguardConnectionConfig = {
        dappMetadata: {
          name: 'Aztec Bridge and Seek',
          description: 'Privacy-first cross-chain bridge application built on Aztec Network',
          url: window.location.origin,
          icon: `${window.location.origin}/favicon.ico`
        },
        permissions: [
          {
            chains: ['aztec:11155111'], // Testnet as primary (matching Azguard test dapp)
            methods: [
              'register_contract',
              'send_transaction', 
              'simulate_views',
              'add_private_authwit',
              'call'
            ]
          }
        ]
      };

      // Log the configuration for debugging
      console.log('🔧 Azguard connection config:', config);

      // Try to connect with primary config, fallback to minimal config if it fails
      let accounts: CaipAccount[];
      try {
        accounts = await azguardServiceRef.current.connect(
          config.dappMetadata,
          config.permissions
        );
      } catch (primaryError) {
        console.warn('⚠️ Primary connection config failed, trying minimal config:', primaryError);
        
        // Try different fallback configurations (matching Azguard test dapp patterns)
        const fallbackConfigs = [
          // Try with aztec:1337 (local development)
          {
            dappMetadata: { name: 'Aztec Bridge and Seek' },
            permissions: [{ chains: ['aztec:1337'], methods: ['register_contract', 'send_transaction'] }]
          },
          // Try with aztec:31337 (sandbox)
          {
            dappMetadata: { name: 'Aztec Bridge and Seek' },
            permissions: [{ chains: ['aztec:31337'], methods: ['register_contract', 'send_transaction'] }]
          },
          // Try minimal with just register_contract
          {
            dappMetadata: { name: 'Aztec Bridge and Seek' },
            permissions: [{ chains: ['aztec:11155111'], methods: ['register_contract'] }]
          }
        ];

        let lastError = primaryError;
        for (let i = 0; i < fallbackConfigs.length; i++) {
          try {
            console.log(`🔧 Trying fallback config ${i + 1}:`, fallbackConfigs[i]);
            accounts = await azguardServiceRef.current.connect(
              fallbackConfigs[i].dappMetadata,
              fallbackConfigs[i].permissions
            );
            break; // Success, exit loop
          } catch (fallbackError) {
            console.warn(`⚠️ Fallback config ${i + 1} failed:`, fallbackError);
            lastError = fallbackError;
            if (i === fallbackConfigs.length - 1) {
              throw lastError; // Throw the last error if all configs fail
            }
          }
        }
      }

      // Update state
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        accounts,
        selectedAccount: accounts.length > 0 ? accounts[0] : null,
        error: null
      }));

      addMessage({
        message: `Connected to Azguard wallet with ${accounts.length} account(s)`,
        type: 'success',
        source: 'azguard'
      });

      console.log('✅ Connected to Azguard wallet:', accounts);
    }, 'connect to Azguard wallet');
  };

  /**
   * Disconnect from Azguard wallet
   */
  const disconnect = async (): Promise<void> => {
    return executeAsync(async () => {
      if (!azguardServiceRef.current) {
        return;
      }

      await azguardServiceRef.current.disconnect();

      setState(prev => ({
        ...prev,
        isConnected: false,
        accounts: [],
        selectedAccount: null,
        error: null
      }));

      addMessage({
        message: 'Disconnected from Azguard wallet',
        type: 'info',
        source: 'azguard'
      });

      console.log('✅ Disconnected from Azguard wallet');
    }, 'disconnect from Azguard wallet');
  };

  /**
   * Switch to a different account
   */
  const switchAccount = async (account: CaipAccount): Promise<void> => {
    return executeAsync(async () => {
      if (!state.accounts.includes(account)) {
        throw new Error('Account not found in connected accounts');
      }

      setState(prev => ({
        ...prev,
        selectedAccount: account
      }));

      console.log('✅ Switched to account:', account);
    }, 'switch account');
  };

  /**
   * Execute operations through Azguard wallet
   */
  const executeOperations = async (operations: Operation[]): Promise<OperationResult[]> => {
    if (!azguardServiceRef.current) {
      throw new Error('Azguard service not initialized');
    }

    if (!state.isConnected) {
      throw new Error('Azguard wallet not connected');
    }

    try {
      const results = await azguardServiceRef.current.executeOperations(operations);
      
      console.log('✅ Operations executed successfully:', results);
      return results;
    } catch (error) {
      console.error('❌ Failed to execute operations:', error);
      throw error;
    }
  };

  /**
   * Check if account is deployed
   */
  const isAccountDeployed = async (account: CaipAccount): Promise<boolean> => {
    if (!accountAdapterRef.current) {
      throw new Error('Account adapter not initialized');
    }

    try {
      return await accountAdapterRef.current.isAccountDeployed(account);
    } catch (error) {
      console.error('❌ Failed to check account deployment:', error);
      return false;
    }
  };

  /**
   * Get AccountWallet for the given CAIP account
   */
  const getAccountWallet = async (account: CaipAccount): Promise<AccountWallet> => {
    if (!accountAdapterRef.current) {
      throw new Error('Account adapter not initialized');
    }

    try {
      return await accountAdapterRef.current.toAccountWallet(account);
    } catch (error) {
      console.error('❌ Failed to get AccountWallet:', error);
      throw error;
    }
  };

  /**
   * Get the current AccountWallet for the selected account
   */
  const getCurrentAccountWallet = async (): Promise<AccountWallet | null> => {
    if (!state.selectedAccount) {
      return null;
    }

    try {
      return await getAccountWallet(state.selectedAccount);
    } catch (error) {
      console.error('❌ Failed to get current AccountWallet:', error);
      return null;
    }
  };

  // Context value
  const contextValue: AzguardWalletContextType = {
    // State
    state,
    client: azguardServiceRef.current,

    // Actions
    connect,
    disconnect,
    switchAccount,

    // Operations
    executeOperations,

    // Utility
    isAccountDeployed,
    getAccountWallet
  };

  return (
    <AzguardWalletContext.Provider value={contextValue}>
      {children}
    </AzguardWalletContext.Provider>
  );
};
