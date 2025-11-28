import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { type AccountWallet } from '@aztec/aztec.js';
import { useAsyncOperation, useConfig } from '../hooks';
import { useError } from './ErrorProvider';
import { DEFAULT_NETWORK } from '../config/networks';
import { initializeWalletServices, WalletServices, createWalletActionServices, createAccount, connectTestAccount, connectExistingAccount } from '../services/aztec/wallet';
import { AztecDripperService, AztecTokenService } from '../services';
import { isValidConfig } from '../utils';

interface AztecWalletContextType {
  // State
  isInitialized: boolean;
  connectedAccount: AccountWallet | null;
  isLoading: boolean;
  error: string | null;
  isDeploying: boolean;
  initializationTimedOut: boolean;

  // Core services
  walletService: { getPXE: () => ReturnType<typeof import('../services/aztec/core/AztecWalletService').AztecWalletService.prototype.getPXE> } | null;
  
  // Contract services
  dripperService: AztecDripperService | null;
  tokenService: AztecTokenService | null;

  // Actions
  createAccount: () => Promise<AccountWallet>;
  connectTestAccount: (index: number) => Promise<AccountWallet>;
  connectExistingAccount: () => Promise<AccountWallet | null>;
  disconnectWallet: () => void;
  reinitialize: () => Promise<void>;
  forceShowWalletSelector: () => void;
}

export const AztecWalletContext = createContext<
  AztecWalletContextType | undefined
>(undefined);

interface AztecWalletProviderProps {
  children: ReactNode;
}

export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({
  children,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedAccount, setConnectedAccount] =
    useState<AccountWallet | null>(null);
  const [dripperService, setDripperService] =
    useState<AztecDripperService | null>(null);
  const [tokenService, setTokenService] = useState<AztecTokenService | null>(
    null
  );
  const [isDeploying, setIsDeploying] = useState(false);
  const [initializationTimedOut, setInitializationTimedOut] = useState(false);
  const [forceWalletSelector, setForceWalletSelector] = useState(false);

  const walletServicesRef = useRef<WalletServices | null>(null);
  const isInitializingRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config, resetToDefault } = useConfig();
  const { addMessage } = useError();

  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('🔄 Initialization already in progress, skipping');
      return;
    }

    if (!isValidConfig(config)) {
      console.warn('⚠️ Network not ready, switching to default network:', config.name);
      
      if (config.name !== DEFAULT_NETWORK.name) {
        console.log('🔄 Switching to default network due to bad configuration');
        resetToDefault();
        return;
      }
      
      console.error('❌ Default network is not ready - this should not happen');
      return;
    }

    if (isInitialized) {
      handleNetworkSwitch();
    }

    handleAutoInitialize();
  }, [config]);

  useEffect(() => {
    if (connectedAccount && isInitialized && walletServicesRef.current) {
      recreateServices();
    }
  }, [connectedAccount, isInitialized]);

  const recreateServices = async () => {
    if (!walletServicesRef.current || !connectedAccount) return;

    const actionServices = createWalletActionServices(
      walletServicesRef.current,
      config,
      () => connectedAccount
    );

    setDripperService(actionServices.dripperService);
    setTokenService(actionServices.tokenService);
  };

  const handleNetworkSwitch = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setIsInitialized(false);
    setInitializationTimedOut(false);
    setForceWalletSelector(false);
    
    isInitializingRef.current = false;
  };

  const handleAutoInitialize = async () => {
    try {
      isInitializingRef.current = true;
      
      await executeAsync(async () => {
        const services = await initializeWalletServices(config.nodeUrl);
        walletServicesRef.current = services;
        setIsInitialized(true);

        // Auto-reconnect if account exists in localStorage
        const savedAccount = services.storageService.getAccount();
        if (savedAccount) {
          console.log('🔄 Found saved account, auto-reconnecting...');
          try {
            const wallet = await connectExistingAccount(services, setIsDeploying, addMessage, config);
            if (wallet) {
              setConnectedAccount(wallet);
              console.log('✅ Auto-reconnected to saved account:', wallet.getAddress().toString());
            }
          } catch (reconnectError) {
            console.warn('⚠️ Failed to auto-reconnect, clearing saved account:', reconnectError);
            services.storageService.clearAccount();
          }
        }
      }, 'initialize wallet services');
    } catch (err) {
      console.error('App initialization failed:', err);
      
      // For testnet errors, show debug modal immediately
      if (config.isTestnet && !isInitialized) {
        console.warn('⚠️ Testnet initialization failed, showing debug modal immediately');
        setInitializationTimedOut(true);
      }
    } finally {
      isInitializingRef.current = false;
    }
  };

  const handleCreateAccount = async (): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await createAccount(walletServicesRef.current, setIsDeploying, addMessage, config);
      setConnectedAccount(wallet);
      return wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<AccountWallet> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectTestAccount(walletServicesRef.current.walletService, index);
      setConnectedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWallet | null> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectExistingAccount(walletServicesRef.current, setIsDeploying, addMessage, config);
      if (wallet) {
        setConnectedAccount(wallet);
      }
      return wallet;
    }, 'connect existing account');
  };

  const disconnectWallet = () => {
    setConnectedAccount(null);
    setDripperService(null);
    setTokenService(null);
    setIsDeploying(false);
    // Don't reset isInitialized - that's for app initialization, not wallet connection
    if (walletServicesRef.current) {
      walletServicesRef.current.storageService.clearAccount();
    }
  };

  const reinitialize = async () => {
    return executeAsync(async () => {
      const services = await initializeWalletServices(config.nodeUrl);
      walletServicesRef.current = services;
      setIsInitialized(true);
    }, 'reinitialize wallet');
  };

  const contextValue: AztecWalletContextType = {
    isInitialized: isInitialized || forceWalletSelector,
    connectedAccount,
    isLoading,
    error,
    isDeploying,
    initializationTimedOut,
    walletService: walletServicesRef.current?.walletService ?? null,
    dripperService,
    tokenService,
    createAccount: handleCreateAccount,
    connectTestAccount: handleConnectTestAccount,
    connectExistingAccount: handleConnectExistingAccount,
    disconnectWallet,
    reinitialize,
    forceShowWalletSelector: () => setForceWalletSelector(true),
  };

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
    </AztecWalletContext.Provider>
  );
};
