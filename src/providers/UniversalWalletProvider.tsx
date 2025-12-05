/**
 * Universal Wallet Provider
 */

import React, { createContext, ReactNode, useRef } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../types/aztec';
import { useEmbeddedWalletInternal, useAzguardWalletInternal, useNetworkInternal } from './hooks';
import type { WalletConnector, WalletConnectorId } from '../types/walletConnector';
import { EmbeddedConnector, AzguardConnector } from '../connectors';
import { createAztecWalletKit, AztecWalletKit } from '../sdk/walletKit';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import type { NetworkConfig } from '../config/networks';

export interface NetworkContextType {
  currentConfig: NetworkConfig;
  getNetworkOptions: () => Array<{
    value: string;
    label: string;
    description: string;
    disabled: boolean;
  }>;
  switchToNetwork: (networkName: string) => boolean;
  resetToDefault: () => void;
}

export interface WalletContextType {
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

// Combined context type
export interface UniversalWalletContextType extends NetworkContextType, WalletContextType {}

export const UniversalWalletContext = createContext<UniversalWalletContextType | undefined>(undefined);

interface UniversalWalletProviderProps {
  config: WalletKitConfig;
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<UniversalWalletProviderProps> = ({ 
  config: walletKitConfig, 
  children 
}) => {
  // Internal hooks - each manages its own state
  const network = useNetworkInternal({
    networks: walletKitConfig.networks,
  });

  const embedded = useEmbeddedWalletInternal({
    config: network.state.currentConfig,
    resetToDefault: network.actions.resetToDefault,
  });

  const azguard = useAzguardWalletInternal({
    config: network.state.currentConfig,
  });

  const walletKitRef = useRef<AztecWalletKit | null>(null);
  if (!walletKitRef.current) {
    walletKitRef.current = createAztecWalletKit({
      aztecNode: network.state.currentConfig.nodeUrl,
      connectors: walletKitConfig.connectors,
    });
  }
  const walletKit = walletKitRef.current;

  const connectors = walletKit.getConnectors();
  for (const connector of connectors) {
    if (connector instanceof EmbeddedConnector) {
      connector.updateState(embedded);
    } else if (connector instanceof AzguardConnector) {
      connector.updateState(azguard);
    }
  }

  const activeConnector = connectors.find((c) => c.getStatus().isConnected) ?? null;

  const isConnected = activeConnector !== null;
  const activeAccount = activeConnector?.getAccount() ?? null;
  const activeWalletType = activeConnector?.type ?? null;
  const isInitialized = embedded.state.isInitialized || azguard.state.isConnected;

  const connectWith = async (connectorId: WalletConnectorId): Promise<WalletConnector> => {
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
    currentConfig: network.state.currentConfig,
    ...network.actions,

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
