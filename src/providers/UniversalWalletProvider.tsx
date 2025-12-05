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
import type { WalletConnector, WalletConnectorId } from '../types/walletConnector';
import { EmbeddedConnector, AzguardConnector } from '../connectors';
import { createAztecWalletKit, AztecWalletKit } from '../sdk/walletKit';
import { walletKitConfig } from '../config/walletKit';
import { resolveWalletKitNode } from '../sdk/walletKitConfig';
import type { AztecNetwork } from '../config/networks/constants';

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
  // Internal wallet hooks - each connector type needs its state hook wired here
  const embedded = useEmbeddedWalletInternal();
  const azguard = useAzguardWalletInternal();

  const embeddedRef = useRef(embedded);
  const azguardRef = useRef(azguard);

  embeddedRef.current = embedded;
  azguardRef.current = azguard;

  const { currentConfig: config } = useConfig();

  const walletKitRef = useRef<AztecWalletKit | null>(null);
  if (!walletKitRef.current) {
    const resolvedNodeUrl = resolveWalletKitNode(
      walletKitConfig.networks,
      config.name as AztecNetwork,
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
      getAccountWallet: () => azguardRef.current.accountWallet,
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
