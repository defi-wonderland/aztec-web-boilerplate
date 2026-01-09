import React, {
  type ReactNode,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import { setNetworkPresets } from '../hooks/context/useUniversalWallet';
import { createAztecWalletKit, type AztecWalletKit } from '../sdk/walletKit';
import {
  getNetworkStore,
  useCurrentNetwork,
  useNetworkActions,
} from '../store/network';
import { useWalletState } from '../store/wallet';
import { WalletType } from '../types/aztec';
import { isValidConfig } from '../utils';
import { WalletContext, type WalletContextType } from './WalletContext';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import type {
  WalletConnector,
  WalletConnectorId,
} from '../types/walletConnector';

export type { WalletContextType } from './WalletContext';
export { WalletContext } from './WalletContext';

interface UniversalWalletProviderProps {
  config: WalletKitConfig;
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<
  UniversalWalletProviderProps
> = ({ config: walletKitConfig, children }) => {
  const { initialize: initializeNetwork, resetToDefault } = useNetworkActions();
  const currentConfig = useCurrentNetwork();

  // Initialize network presets
  useEffect(() => {
    setNetworkPresets(walletKitConfig.networks);

    if (!getNetworkStore().isInitialized) {
      initializeNetwork(walletKitConfig.networks);
    }
  }, [walletKitConfig.networks, initializeNetwork]);

  // Validate config on change
  useEffect(() => {
    if (!isValidConfig(currentConfig)) {
      console.warn(
        `⚠️ Invalid config for ${currentConfig.name}, falling back to default`
      );
      resetToDefault();
    }
  }, [currentConfig, resetToDefault]);

  const [walletKit] = useState<AztecWalletKit>(() =>
    createAztecWalletKit({
      aztecNode: currentConfig.nodeUrl,
      connectors: walletKitConfig.connectors,
    })
  );

  const connectors = walletKit.getConnectors();

  const { account, status, walletType, error, isPXEReady } = useWalletState();

  // Find active connector - re-evaluate when wallet state changes
  const activeConnector = useMemo(() => {
    void account;
    void walletType;
    void status;

    return (
      connectors.find((c) => {
        try {
          return c.getStatus().status === 'connected';
        } catch {
          return false;
        }
      }) ?? null
    );
  }, [connectors, account, walletType, status]);

  const activeAccount = activeConnector?.getAccount() ?? null;
  const activeWalletType = activeConnector?.type ?? null;

  // Derive state from store
  const derivedState = useMemo(() => {
    const isConnected = activeConnector !== null;
    const isInitialized =
      isPXEReady || walletType === WalletType.BROWSER_WALLET;
    const isLoading = status === 'connecting' || status === 'deploying';

    return {
      walletType: activeWalletType,
      isConnected,
      isInitialized,
      isLoading,
      error,
    };
  }, [
    activeConnector,
    activeWalletType,
    isPXEReady,
    walletType,
    status,
    error,
  ]);

  // Connect to a specific connector
  const connectWith = useCallback(
    async (connectorId: WalletConnectorId): Promise<WalletConnector> => {
      if (activeConnector && activeConnector.id !== connectorId) {
        await activeConnector.disconnect();
      }
      return walletKit.connect(connectorId);
    },
    [activeConnector, walletKit]
  );

  // Disconnect current connector
  const handleDisconnect = useCallback(async (): Promise<void> => {
    if (!activeConnector) return;
    await activeConnector.disconnect();
  }, [activeConnector]);

  const contextValue: WalletContextType = useMemo(
    () => ({
      connectors,
      connector: activeConnector,
      account: activeAccount,
      ...derivedState,
      connect: connectWith,
      disconnect: handleDisconnect,
    }),
    [
      connectors,
      activeConnector,
      activeAccount,
      derivedState,
      connectWith,
      handleDisconnect,
    ]
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};
