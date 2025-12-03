/**
 * Universal Wallet Provider
 * Consolidated provider that manages both embedded and Azguard wallets
 *
 * This provider composes two internal hooks:
 * - useEmbeddedWalletInternal: Manages embedded wallet (local keys)
 * - useAzguardWalletInternal: Manages Azguard browser extension
 */

import React, { createContext, useEffect, ReactNode, useRef } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import type { AzguardClient } from '@azguardwallet/client';
import type {
  CaipAccount,
  Operation,
  OperationResult,
} from '@azguardwallet/types';
import type { AzguardWalletState } from '../types/azguard';
import { WalletType } from '../types/aztec';
import { useEmbeddedWalletInternal, useAzguardWalletInternal } from './hooks';
import { useConfig } from '../hooks/context/useConfig';
import { DEFAULT_NETWORK } from '../config/networks';
import { isValidConfig } from '../utils';
import { buildRegisterContractOperations } from '../utils/azguard';

interface EmbeddedWalletActions {
  create: () => Promise<AccountWithSecretKey>;
  connectTest: (index: number) => Promise<AccountWithSecretKey>;
  connectExisting: () => Promise<AccountWithSecretKey | null>;
  isDeploying: boolean;
  forceShowSelector: () => void;
}

interface AzguardWalletActions {
  connect: () => Promise<void>;
  switchAccount: (account: CaipAccount) => Promise<void>;
  executeOperations: (ops: Operation[]) => Promise<OperationResult[]>;
  state: AzguardWalletState;
  client: AzguardClient | null;
}

export interface UniversalWalletContextType {
  isConnected: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  walletType: WalletType | null;
  account: AccountWithSecretKey | null;

  pxe: PXE | null;
  wallet: Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;

  disconnect: () => Promise<void>;
  reinitialize: () => Promise<void>;

  embedded: EmbeddedWalletActions;

  azguard: AzguardWalletActions;
}

export const UniversalWalletContext = createContext<
  UniversalWalletContextType | undefined
>(undefined);

interface UniversalWalletProviderProps {
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<
  UniversalWalletProviderProps
> = ({ children }) => {
  // Compose internal hooks
  const embedded = useEmbeddedWalletInternal();
  const azguard = useAzguardWalletInternal();
  const azguardRegistrationRef = useRef<string | null>(null);

  const { currentConfig: config, resetToDefault } = useConfig();

  useEffect(() => {
    if (!isValidConfig(config)) {
      console.warn(
        '⚠️ Network not ready, switching to default network:',
        config.name
      );

      if (config.name !== DEFAULT_NETWORK.name) {
        console.log('🔄 Switching to default network due to bad configuration');
        resetToDefault();
        return;
      }

      console.error('❌ Default network is not ready - this should not happen');
      return;
    }

    if (embedded.state.isInitialized) {
      embedded.handleNetworkSwitch();
    }

    embedded.initialize(config);
  }, [config]);

  useEffect(() => {
    if (!azguard.state.isConnected || !azguard.state.selectedAccount) {
      azguardRegistrationRef.current = null;
      return;
    }

    const registrationKey = `${config.name}:${azguard.state.selectedAccount}`;
    if (azguardRegistrationRef.current === registrationKey) {
      return;
    }

    let isActive = true;

    const registerContractsWithAzguard = async () => {
      try {
        const operations = await buildRegisterContractOperations(config);
        if (!isActive || operations.length === 0) {
          return;
        }
        
        console.log(`📝 Registering ${operations.length} contracts with Azguard...`);
        const results = await azguard.actions.executeOperations(operations);
        
        // Check results and log status
        const succeeded = results.filter(r => r.status === 'ok').length;
        const failed = results.filter(r => r.status === 'failed').length;
        
        if (failed > 0) {
          console.warn(`⚠️ Contract registration: ${succeeded}/${operations.length} succeeded, ${failed} failed`);
          // Log which contracts failed
          results.forEach((result, index) => {
            if (result.status === 'failed') {
              const errorMsg = 'error' in result ? result.error : 'Unknown error';
              console.error(`  - Operation ${index} failed: ${errorMsg}`);
            }
          });
        } else {
          console.log(`✅ All ${succeeded} contracts registered with Azguard successfully`);
        }
        
        if (isActive) {
          azguardRegistrationRef.current = registrationKey;
        }
      } catch (err) {
        console.error('❌ Failed to register contracts with Azguard wallet:', err);
      }
    };

    registerContractsWithAzguard();

    return () => {
      isActive = false;
    };
  }, [
    azguard.actions,
    azguard.state.isConnected,
    azguard.state.selectedAccount,
    config,
  ]);

  const [azguardAccountWallet, setAzguardAccountWallet] =
    React.useState<AccountWithSecretKey | null>(null);

  useEffect(() => {
    const updateAzguardAccount = async () => {
      if (azguard.state.isConnected && azguard.state.selectedAccount) {
        try {
          const wallet = await azguard.getAccountWallet(
            azguard.state.selectedAccount
          );
          setAzguardAccountWallet(wallet);
        } catch (err) {
          console.error('Failed to get Azguard AccountWallet:', err);
          setAzguardAccountWallet(null);
        }
      } else {
        setAzguardAccountWallet(null);
      }
    };

    updateAzguardAccount();
  }, [azguard.state.isConnected, azguard.state.selectedAccount]);

  const activeAccount = azguardAccountWallet ?? embedded.state.embeddedAccount;
  const activeWalletType = azguardAccountWallet
    ? WalletType.AZGUARD
    : embedded.state.embeddedAccount
      ? WalletType.EMBEDDED
      : null;

  const handleDisconnect = async (): Promise<void> => {
    if (activeWalletType === WalletType.AZGUARD) {
      await azguard.actions.disconnect();
    } else if (activeWalletType === WalletType.EMBEDDED) {
      embedded.actions.disconnect();
    }
  };

  const contextValue: UniversalWalletContextType = {
    isConnected: activeAccount !== null,
    isInitialized: embedded.state.isInitialized,
    isLoading: embedded.isLoading || azguard.isLoading,
    error: embedded.error || azguard.error,
    walletType: activeWalletType,
    account: activeAccount,

    pxe: embedded.services.pxe,
    wallet: embedded.services.wallet,
    getSponsoredFeePaymentMethod:
      embedded.services.getSponsoredFeePaymentMethod,

    disconnect: handleDisconnect,
    reinitialize: embedded.actions.reinitialize,

    embedded: {
      create: embedded.actions.create,
      connectTest: embedded.actions.connectTest,
      connectExisting: embedded.actions.connectExisting,
      isDeploying: embedded.state.isDeploying,
      forceShowSelector: embedded.actions.forceShowSelector,
    },

    azguard: {
      connect: azguard.actions.connect,
      switchAccount: azguard.actions.switchAccount,
      executeOperations: azguard.actions.executeOperations,
      state: azguard.state,
      client: azguard.client,
    },
  };

  return (
    <UniversalWalletContext.Provider value={contextValue}>
      {children}
    </UniversalWalletContext.Provider>
  );
};
