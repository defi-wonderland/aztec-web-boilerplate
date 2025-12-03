/**
 * Internal hook for embedded wallet management
 * Used by UniversalWalletProvider - not for direct consumption
 */

import { useState, useRef } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import {
  initializeWalletServices,
  WalletServices,
  createAccount,
  connectTestAccount,
  connectExistingAccount,
} from '../../services/aztec/wallet';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useConfig } from '../../hooks/context/useConfig';
import { useError } from '../ErrorProvider';
import type { AppConfig } from '../../config/networks';

export interface EmbeddedWalletState {
  embeddedAccount: AccountWithSecretKey | null;
  isDeploying: boolean;
  isInitialized: boolean;
  forceWalletSelector: boolean;
}

export interface EmbeddedWalletActions {
  create: () => Promise<AccountWithSecretKey>;
  connectTest: (index: number) => Promise<AccountWithSecretKey>;
  connectExisting: () => Promise<AccountWithSecretKey | null>;
  disconnect: () => void;
  forceShowSelector: () => void;
  reinitialize: () => Promise<void>;
}

export interface EmbeddedWalletServices {
  pxe: PXE | null;
  wallet: Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface UseEmbeddedWalletInternalReturn {
  state: EmbeddedWalletState;
  actions: EmbeddedWalletActions;
  services: EmbeddedWalletServices;
  isLoading: boolean;
  error: string | null;
  initialize: (config: AppConfig) => Promise<void>;
  handleNetworkSwitch: () => void;
}

export const useEmbeddedWalletInternal = (): UseEmbeddedWalletInternalReturn => {
  const [embeddedAccount, setEmbeddedAccount] = useState<AccountWithSecretKey | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [forceWalletSelector, setForceWalletSelector] = useState(false);

  const walletServicesRef = useRef<WalletServices | null>(null);
  const isInitializingRef = useRef(false);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { currentConfig: config } = useConfig();
  const { addMessage } = useError();

  const initialize = async (appConfig: AppConfig): Promise<void> => {
    if (isInitializingRef.current) {
      console.log('🔄 Embedded wallet initialization already in progress, skipping');
      return;
    }

    try {
      isInitializingRef.current = true;

      await executeAsync(async () => {
        const services = await initializeWalletServices(appConfig.nodeUrl);
        walletServicesRef.current = services;
        setIsInitialized(true);

        // Auto-reconnect if account exists in localStorage
        const savedAccount = services.storageService.getAccount();
        if (savedAccount) {
          console.log('🔄 Found saved account, auto-reconnecting...');
          try {
            const wallet = await connectExistingAccount(
              services,
              setIsDeploying,
              addMessage,
              appConfig
            );
            if (wallet) {
              setEmbeddedAccount(wallet);
              console.log(
                '✅ Auto-reconnected to saved account:',
                wallet.getAddress().toString()
              );
            }
          } catch (reconnectError) {
            console.warn(
              '⚠️ Failed to auto-reconnect, clearing saved account:',
              reconnectError
            );
            services.storageService.clearAccount();
          }
        }
      }, 'initialize wallet services');
    } catch (err) {
      console.error('Embedded wallet initialization failed:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const handleNetworkSwitch = () => {
    setEmbeddedAccount(null);
    setIsInitialized(false);
    setForceWalletSelector(false);
    isInitializingRef.current = false;
  };

  const handleCreateAccount = async (): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await createAccount(
        walletServicesRef.current,
        setIsDeploying,
        addMessage,
        config
      );
      setEmbeddedAccount(wallet);
      return wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectTestAccount(
        walletServicesRef.current.walletService,
        index
      );
      setEmbeddedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWithSecretKey | null> => {
    return executeAsync(async () => {
      if (!walletServicesRef.current) {
        throw new Error('Wallet services not initialized');
      }

      const wallet = await connectExistingAccount(
        walletServicesRef.current,
        setIsDeploying,
        addMessage,
        config
      );
      if (wallet) {
        setEmbeddedAccount(wallet);
      }
      return wallet;
    }, 'connect existing account');
  };

  const handleDisconnect = () => {
    setEmbeddedAccount(null);
    setIsDeploying(false);
    walletServicesRef.current?.storageService.clearAccount();
  };

  const handleReinitialize = async (): Promise<void> => {
    return executeAsync(async () => {
      const services = await initializeWalletServices(config.nodeUrl);
      walletServicesRef.current = services;
      setIsInitialized(true);
    }, 'reinitialize wallet');
  };

  const getSponsoredFeePaymentMethod = async (): Promise<SponsoredFeePaymentMethod> => {
    if (!walletServicesRef.current) {
      throw new Error('Wallet services not initialized');
    }
    return walletServicesRef.current.walletService.getSponsoredFeePaymentMethod();
  };

  const wallet = walletServicesRef.current?.walletService.getWallet() ?? null;
  const pxe = walletServicesRef.current?.walletService.getPXE() ?? null;

  return {
    state: {
      embeddedAccount,
      isDeploying,
      isInitialized: isInitialized || forceWalletSelector,
      forceWalletSelector,
    },
    actions: {
      create: handleCreateAccount,
      connectTest: handleConnectTestAccount,
      connectExisting: handleConnectExistingAccount,
      disconnect: handleDisconnect,
      forceShowSelector: () => setForceWalletSelector(true),
      reinitialize: handleReinitialize,
    },
    services: {
      pxe,
      wallet,
      getSponsoredFeePaymentMethod,
    },
    isLoading,
    error,
    initialize,
    handleNetworkSwitch,
  };
};

