/**
 * Universal Wallet Provider
 *
 * Provides wallet context for all wallet types:
 * - Embedded: App PXE + internal signing
 * - Browser Wallet: External PXE (Azguard, Obsidian, etc.)
 */

import React, { createContext, ReactNode, useRef, useMemo } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../types/aztec';
import {
  useEmbeddedWallet,
  useBrowserWallet,
  useNetworkInternal,
} from './hooks';
import type {
  WalletConnector,
  WalletConnectorId,
} from '../types/walletConnector';
import {
  EmbeddedConnector,
  BrowserWalletConnector,
} from '../connectors';
import { createAztecWalletKit, AztecWalletKit } from '../sdk/walletKit';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import type { NetworkConfig } from '../config/networks';
import type { IBrowserWalletAdapter } from '../types/browserWallet';

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
export interface UniversalWalletContextType
  extends NetworkContextType,
    WalletContextType {}

export const UniversalWalletContext = createContext<
  UniversalWalletContextType | undefined
>(undefined);

interface UniversalWalletProviderProps {
  config: WalletKitConfig;
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<
  UniversalWalletProviderProps
> = ({ config: walletKitConfig, children }) => {
  const network = useNetworkInternal({
    networks: walletKitConfig.networks,
  });

  // Create wallet kit once
  const walletKitRef = useRef<AztecWalletKit | null>(null);
  if (!walletKitRef.current) {
    walletKitRef.current = createAztecWalletKit({
      aztecNode: network.state.currentConfig.nodeUrl,
      connectors: walletKitConfig.connectors,
    });
  }
  const walletKit = walletKitRef.current;
  const connectors = walletKit.getConnectors();

  // Find browser wallet connector and get its adapter (if any)
  const browserWalletAdapterRef = useRef<IBrowserWalletAdapter | null>(null);
  if (!browserWalletAdapterRef.current) {
    const browserConnector = connectors.find(
      (c): c is BrowserWalletConnector => c.type === WalletType.BROWSER_WALLET
    );
    if (browserConnector) {
      browserWalletAdapterRef.current = browserConnector.getAdapter();
    }
  }

  // Embedded wallet hook
  const embedded = useEmbeddedWallet({
    config: network.state.currentConfig,
    resetToDefault: network.actions.resetToDefault,
  });

  // Browser wallet hook (only if we have a browser wallet connector)
  const browserWalletAdapter = browserWalletAdapterRef.current;
  const browserWallet = useBrowserWallet(
    browserWalletAdapter
      ? { config: network.state.currentConfig, adapter: browserWalletAdapter }
      : { config: network.state.currentConfig, adapter: null as any }
  );

  // Update connector states
  for (const connector of connectors) {
    if (
      'updateState' in connector &&
      typeof connector.updateState === 'function'
    ) {
      if (connector.type === WalletType.EMBEDDED) {
        (connector as EmbeddedConnector).updateState(embedded);
      }
      if (
        connector.type === WalletType.BROWSER_WALLET &&
        browserWalletAdapter
      ) {
        (connector as BrowserWalletConnector).updateState(browserWallet);
      }
    }
  }

  // Find active connector
  const activeConnector = useMemo(() => {
    return (
      connectors.find((c) => {
        try {
          return c.getStatus().status === 'connected';
        } catch {
          return false;
        }
      }) ?? null
    );
  }, [
    connectors,
    embedded.state.embeddedAccount,
    browserWallet.state.status,
    browserWallet.accountWallet,
  ]);

  const activeAccount = activeConnector?.getAccount() ?? null;
  const activeWalletType = activeConnector?.type ?? null;

  const isConnected = activeConnector !== null;

  // Determine initialization status based on any initialized wallet
  const isInitialized =
    embedded.state.isInitialized ||
    browserWallet.state.status === 'connected';

  const connectWith = async (
    connectorId: WalletConnectorId
  ): Promise<WalletConnector> => {
    if (activeConnector && activeConnector.id !== connectorId) {
      await activeConnector.disconnect();
    }
    return walletKit.connect(connectorId);
  };

  const handleDisconnect = async (): Promise<void> => {
    if (!activeConnector) return;
    await activeConnector.disconnect();
  };

  const handleReinitialize = async (): Promise<void> => {
    await embedded.actions.reinitialize();
  };

  // Compute loading state
  const isLoading = embedded.isLoading || browserWallet.isLoading;

  // Compute error state
  const error = embedded.error || browserWallet.error;

  const contextValue: UniversalWalletContextType = {
    // Network context
    currentConfig: network.state.currentConfig,
    ...network.actions,

    // Wallet context
    isConnected,
    isInitialized,
    isLoading,
    error,
    walletType: activeWalletType,
    account: activeAccount,
    connector: activeConnector,
    connectors,
    walletKit,
    disconnect: handleDisconnect,
    reinitialize: handleReinitialize,
    connectWith,
  };

  return (
    <UniversalWalletContext.Provider value={contextValue}>
      {children}
    </UniversalWalletContext.Provider>
  );
};
