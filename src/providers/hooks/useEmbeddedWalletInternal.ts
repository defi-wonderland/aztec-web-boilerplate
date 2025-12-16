/**
 * Internal hook for embedded wallet management
 * Used by UniversalWalletProvider - not for direct consumption
 */

import { useState, useRef, useEffect } from 'react';
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
import { useError } from '../ErrorProvider';
import { isValidConfig } from '../../utils';
import type { NetworkConfig } from '../../config/networks';

export interface EmbeddedWalletState {
  embeddedAccount: AccountWithSecretKey | null;
  isDeploying: boolean;
  isInitialized: boolean;
}

export interface EmbeddedWalletActions {
  create: () => Promise<AccountWithSecretKey>;
  connectTest: (index: number) => Promise<AccountWithSecretKey>;
  connectExisting: () => Promise<AccountWithSecretKey | null>;
  disconnect: () => void;
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
}

interface UseEmbeddedWalletInternalOptions {
  config: NetworkConfig;
  resetToDefault: () => void;
}

export const useEmbeddedWalletInternal = (
  options: UseEmbeddedWalletInternalOptions
): UseEmbeddedWalletInternalReturn => {
  const { config, resetToDefault } = options;
  
  const [embeddedAccount, setEmbeddedAccount] = useState<AccountWithSecretKey | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const walletServicesRef = useRef<WalletServices | null>(null);
  const isInitializingRef = useRef(false);
  const pendingConfigRef = useRef<NetworkConfig | null>(null);

  const { isLoading, error, executeAsync } = useAsyncOperation();
  const { addMessage } = useError();

  // Helper to ensure services are initialized
  const getServices = (): WalletServices => {
    if (!walletServicesRef.current) {
      throw new Error('Wallet services not initialized');
    }
    return walletServicesRef.current;
  };

  const initialize = async (targetConfig: NetworkConfig): Promise<void> => {
    if (isInitializingRef.current) {
      pendingConfigRef.current = targetConfig;
      return;
    }

    try {
      isInitializingRef.current = true;
      pendingConfigRef.current = null;

      await executeAsync(async () => {
        const services = await initializeWalletServices(targetConfig.nodeUrl, targetConfig.name);
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
              targetConfig
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
      if (pendingConfigRef.current && pendingConfigRef.current.name !== targetConfig.name) {
        const nextConfig = pendingConfigRef.current;
        pendingConfigRef.current = null;
        initialize(nextConfig);
      }
    }
  };

  // Auto-initialize and handle network changes
  useEffect(() => {
    if (!isValidConfig(config)) {
      console.warn(`⚠️ Invalid config for ${config.name}, falling back to default`);
      resetToDefault();
      return;
    }

    // Reset state on network switch
    if (isInitialized) {
      setEmbeddedAccount(null);
      setIsInitialized(false);
      isInitializingRef.current = false;
    }

    initialize(config);
  }, [config, resetToDefault]);

  const handleCreateAccount = async (): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      const wallet = await createAccount(getServices(), setIsDeploying, addMessage, config);
      setEmbeddedAccount(wallet);
      return wallet;
    }, 'create account');
  };

  const handleConnectTestAccount = async (index: number): Promise<AccountWithSecretKey> => {
    return executeAsync(async () => {
      const wallet = await connectTestAccount(getServices().walletService, index);
      setEmbeddedAccount(wallet);
      return wallet;
    }, 'connect test account');
  };

  const handleConnectExistingAccount = async (): Promise<AccountWithSecretKey | null> => {
    return executeAsync(async () => {
      const wallet = await connectExistingAccount(getServices(), setIsDeploying, addMessage, config);
      if (wallet) setEmbeddedAccount(wallet);
      return wallet;
    }, 'connect existing account');
  };

  const handleDisconnect = () => {
    setEmbeddedAccount(null);
    setIsDeploying(false);
    walletServicesRef.current?.storageService.clearAccount();
  };

  const handleReinitialize = async (): Promise<void> => {
    return initialize(config);
  };

  return {
    state: {
      embeddedAccount,
      isDeploying,
      isInitialized,
    },
    actions: {
      create: handleCreateAccount,
      connectTest: handleConnectTestAccount,
      connectExisting: handleConnectExistingAccount,
      disconnect: handleDisconnect,
      reinitialize: handleReinitialize,
    },
    services: {
      pxe: walletServicesRef.current?.walletService.getPXE() ?? null,
      wallet: walletServicesRef.current?.walletService.getWallet() ?? null,
      getSponsoredFeePaymentMethod: () => getServices().walletService.getSponsoredFeePaymentMethod(),
    },
    isLoading,
    error,
  };
};

