import React, { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { useAsyncOperation, useConfig } from '../hooks';
import { useError } from './ErrorProvider';
import { DEFAULT_NETWORK } from '../config/networks';
import { initializeWalletServices, WalletServices, createAccount, connectTestAccount, connectExistingAccount } from '../services/aztec/wallet';
import { isValidConfig } from '../utils';

interface AztecWalletContextType {
  // State
  isInitialized: boolean;
  connectedAccount: AccountWithSecretKey | null;
  isLoading: boolean;
  error: string | null;
  isDeploying: boolean;
  initializationTimedOut: boolean;

  // Core wallet access
  wallet: Wallet | null;
  pxe: PXE | null;

  // Fee payment
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;

  // Actions
  createAccount: () => Promise<AccountWithSecretKey>;
  connectTestAccount: (index: number) => Promise<AccountWithSecretKey>;
  connectExistingAccount: () => Promise<AccountWithSecretKey | null>;
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
    useState<AccountWithSecretKey | null>(null);
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

  const handleNetworkSwitch = () => {
    setConnectedAccount(null);
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

  const handleCreateAccount = async (): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await createAccount(walletServicesRef.current, setIsDeploying, addMessage, config);
      setConnectedAccount(wallet);
      return wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectTestAccount(walletServicesRef.current.walletService, index);
      setConnectedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWithSecretKey | null> => {
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

  const getSponsoredFeePaymentMethod = useCallback(async (): Promise<SponsoredFeePaymentMethod> => {
    if (!walletServicesRef.current) {
      throw new Error('Wallet services not initialized');
    }
    return walletServicesRef.current.walletService.getSponsoredFeePaymentMethod();
  }, []);

  // Get the wallet and PXE instances
  const wallet = walletServicesRef.current?.walletService.getWallet() ?? null;
  const pxe = walletServicesRef.current?.walletService.getPXE() ?? null;

  const contextValue: AztecWalletContextType = {
    isInitialized: isInitialized || forceWalletSelector,
    connectedAccount,
    isLoading,
    error,
    isDeploying,
    initializationTimedOut,
    wallet,
    pxe,
    getSponsoredFeePaymentMethod,
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
