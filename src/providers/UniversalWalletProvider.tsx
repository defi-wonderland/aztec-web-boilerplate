/**
 * Universal Wallet Provider
 * Consolidated provider that manages both embedded and Azguard wallets
 *
 * This provider composes two internal hooks:
 * - useEmbeddedWalletInternal: Manages embedded wallet (local keys)
 * - useAzguardWalletInternal: Manages Azguard browser extension
 */

import React, { createContext, ReactNode, useRef } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../types/aztec';
import { useEmbeddedWalletInternal, useAzguardWalletInternal } from './hooks';
import { useConfig } from '../hooks/context/useConfig';
import type { WalletConnector, WalletConnectorId } from '../types/walletConnector';
import { EmbeddedConnector, AzguardConnector } from '../connectors';
import { createAztecWalletKit, AztecWalletKit } from '../sdk/walletKit';
import { resolveWalletKitNode, type WalletKitPreset } from '../sdk/walletKitConfig';
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
  config: WalletKitPreset;
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<
  UniversalWalletProviderProps
> = ({ config: walletKitConfig, children }) => {
  // Internal wallet hooks - each connector type needs its state hook wired here
  const embedded = useEmbeddedWalletInternal();
  const azguard = useAzguardWalletInternal();

  const { currentConfig: networkConfig } = useConfig();

  const walletKitRef = useRef<AztecWalletKit | null>(null);
  if (!walletKitRef.current) {
    const resolvedNodeUrl = resolveWalletKitNode(
      walletKitConfig.networks,
      networkConfig.name as AztecNetwork,
      networkConfig.nodeUrl
    );
    walletKitRef.current = createAztecWalletKit({
      aztecNode: resolvedNodeUrl,
      connectors: walletKitConfig.connectors,
    });
  }
  const walletKit = walletKitRef.current;

  // Update connectors with latest hook state
  const connectors = walletKit.getConnectors();
  for (const connector of connectors) {
    if (connector instanceof EmbeddedConnector) {
      connector.updateState(embedded);
    } else if (connector instanceof AzguardConnector) {
      connector.updateState(azguard);
    }
  }

  // Find the connected connector (only one can be connected at a time)
  const activeConnector = connectors.find((c) => c.getStatus().isConnected) ?? null;

  // Derive state from active connector (single source of truth)
  const isConnected = activeConnector !== null;
  const activeAccount = activeConnector?.getAccount() ?? null;
  const activeWalletType = activeConnector?.type ?? null;
  const isInitialized = embedded.state.isInitialized || azguard.state.isConnected;

  const connectWith = async (connectorId: WalletConnectorId): Promise<WalletConnector> => {
    // Disconnect current connector first (single connection at a time)
    if (activeConnector && activeConnector.id !== connectorId) {
      await activeConnector.disconnect();
    }
    return walletKit.connect(connectorId);
  };

  const handleDisconnect = async (): Promise<void> => {
    if (!activeConnector) return;
    await activeConnector.disconnect();
  };

  const contextValue: UniversalWalletContextType = {
    isConnected,
    isInitialized,
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
