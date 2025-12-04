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
import { WalletType } from '../types/aztec';
import { useEmbeddedWalletInternal, useAzguardWalletInternal } from './hooks';
import { useConfig } from '../hooks/context/useConfig';
import type { AztecChainId } from '../config/networks/constants';
import { DEFAULT_NETWORK } from '../config/networks';
import { isValidConfig } from '../utils';
import { buildRegisterContractOperations } from '../utils/azguard';
import type { WalletConnector, WalletConnectorId } from '../types/walletConnector';
import { EmbeddedConnector, AzguardConnector } from '../connectors';
import { createAztecWalletKit, AztecWalletKit } from '../sdk/walletKit';
import { walletKitConfig } from '../config/walletKit';
import { resolveWalletKitNode } from '../sdk/walletKitConfig';

export interface UniversalWalletContextType {
  isConnected: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  walletType: WalletType | null;
  account: AccountWithSecretKey | null;

  connector: WalletConnector | null;
  connectors: WalletConnector[];
  walletKit: AztecWalletKit;

  disconnect: () => Promise<void>;
  reinitialize: () => Promise<void>;
  connectWith: (connectorId: WalletConnectorId) => Promise<WalletConnector>;
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
  const embedded = useEmbeddedWalletInternal();
  const azguard = useAzguardWalletInternal();
  const azguardRegistrationRef = useRef<string | null>(null);
  const embeddedRef = useRef(embedded);
  const azguardRef = useRef(azguard);

  embeddedRef.current = embedded;
  azguardRef.current = azguard;

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
        const chainFromAccount = azguard.state.selectedAccount
          ? (`${azguard.state.selectedAccount.split(':').slice(0, 2).join(':')}` as AztecChainId)
          : undefined;

        const operations = await buildRegisterContractOperations(
          config,
          undefined,
          chainFromAccount
        );
        if (!isActive || operations.length === 0) {
          return;
        }
        
        console.log(`📝 Registering ${operations.length} contracts with Azguard...`);
        const results = await azguard.actions.executeOperations(operations);
        
        const succeeded = results.filter(r => r.status === 'ok').length;
        const failed = results.filter(r => r.status === 'failed').length;
        
        if (failed > 0) {
          console.warn(`⚠️ Contract registration: ${succeeded}/${operations.length} succeeded, ${failed} failed`);
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
    // Note: azguard.actions is intentionally excluded - it's stable but recreated on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    azguard.state.isConnected,
    azguard.state.selectedAccount,
    config,
  ]);

  const [azguardAccountWallet, setAzguardAccountWallet] =
    React.useState<AccountWithSecretKey | null>(null);
  const azguardAccountWalletRef = useRef<AccountWithSecretKey | null>(null);

  useEffect(() => {
    azguardAccountWalletRef.current = azguardAccountWallet;
  }, [azguardAccountWallet]);

  const walletKitRef = useRef<AztecWalletKit | null>(null);
  if (!walletKitRef.current) {
    const resolvedNodeUrl = resolveWalletKitNode(
      walletKitConfig.networks,
      config.name as 'sandbox' | 'devnet',
      config.nodeUrl
    );
    walletKitRef.current = createAztecWalletKit({
      aztecNode: resolvedNodeUrl,
      connectors: walletKitConfig.connectors,
    });
  }
  const walletKit = walletKitRef.current;

  const embeddedConnectorInstance = walletKit.getConnector('embedded');
  if (embeddedConnectorInstance instanceof EmbeddedConnector) {
    embeddedConnectorInstance.setResolver(() => embeddedRef.current);
  }
  const azguardConnectorInstance = walletKit.getConnector('azguard');
  if (azguardConnectorInstance instanceof AzguardConnector) {
    azguardConnectorInstance.setResolvers({
      getAzguard: () => azguardRef.current,
      getAccountWallet: () => azguardAccountWalletRef.current,
    });
  }

  const connectors = walletKit.getConnectors();
  const activeConnector =
    azguard.state.isConnected && azguardConnectorInstance instanceof AzguardConnector
      ? azguardConnectorInstance
      : connectors.find((connector) => connector.getAccount()) ?? null;

  const connectWith = (connectorId: WalletConnectorId) => {
    return walletKit.connect(connectorId);
  };

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

  const activeAccount = activeConnector?.getAccount() ?? null;
  const hasEmbeddedAccount = embedded.state.embeddedAccount !== null;
  const hasAzguardConnection = azguard.state.isConnected;
  const activeWalletType = hasAzguardConnection
    ? WalletType.AZGUARD
    : hasEmbeddedAccount
      ? WalletType.EMBEDDED
      : activeConnector?.type ?? null;
  const isAnyWalletConnected = hasEmbeddedAccount || hasAzguardConnection;
  const isProviderInitialized = embedded.state.isInitialized || hasAzguardConnection;

  const handleDisconnect = async (): Promise<void> => {
    if (activeConnector) {
      await activeConnector.disconnect();
      return;
    }

    if (azguard.state.isConnected) {
      await azguard.actions.disconnect();
    }

    embedded.actions.disconnect();
  };

  const contextValue: UniversalWalletContextType = {
    isConnected: isAnyWalletConnected,
    isInitialized: isProviderInitialized,
    isLoading: embedded.isLoading || azguard.isLoading,
    error: embedded.error || azguard.error,
    walletType: activeWalletType,
    account: activeAccount,
    connector: activeConnector,
    connectors,
    walletKit,

    disconnect: handleDisconnect,
    reinitialize: embedded.actions.reinitialize,
    connectWith,
  };

  return (
    <UniversalWalletContext.Provider value={contextValue}>
      {children}
    </UniversalWalletContext.Provider>
  );
};
