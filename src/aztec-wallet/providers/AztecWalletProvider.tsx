import React, { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isValidConfig } from '../../utils';
import { AztecWalletModals } from '../components/AztecWalletModals';
import { createAztecWalletConfig } from '../config';
import { createConnectorRegistry } from '../connectors/registry';
import { useEIP6963Discovery } from '../hooks/useEIP6963Discovery';
import { getEIP6963Service, getEVMWalletService } from '../services/evm';
import { getNetworkStore, useNetworkStore } from '../store/network';
import {
  useWalletStore,
  getWalletStore,
  getStoredWalletConnection,
  setupWalletCrossTabSync,
} from '../store/wallet';
import { WalletType } from '../types/aztec';
import { AztecWalletContext } from './context';
import type { AztecNetwork } from '../../config/networks/constants';
import type { ExternalSignerWalletConnector } from '../../types/walletConnector';
import type {
  AztecWalletConfig,
  NetworkPreset,
  StoreNetworkPreset,
} from '../types';

export interface AztecWalletProviderProps {
  /** AztecWallet configuration */
  config: AztecWalletConfig;
  /** Child components */
  children: React.ReactNode;
}

/**
 * Internal component that handles auto-reconnection on mount.
 * Automatically reconnects to the last connected wallet when the app loads.
 */
const AutoReconnect: React.FC = () => {
  const autoConnectAttempted = useRef(false);

  const connectors = useWalletStore((state) => state.connectors);
  const status = useWalletStore((state) => state.status);

  const walletActions = useWalletStore(
    useShallow((state) => ({
      connect: state.connect,
      connectExistingEmbedded: state.connectExistingEmbedded,
      hasSavedEmbeddedAccount: state.hasSavedEmbeddedAccount,
    }))
  );

  const isInitialized = connectors.length > 0;
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'deploying';

  useEffect(() => {
    // Only attempt once, when initialized, and not already connected
    if (
      autoConnectAttempted.current ||
      !isInitialized ||
      isConnected ||
      isConnecting
    ) {
      return;
    }

    autoConnectAttempted.current = true;

    // Check if there was an active connection saved
    const storedConnection = getStoredWalletConnection();

    if (!storedConnection) {
      console.log('AztecWallet: No saved connection found');
      return;
    }

    const { connectorId, walletType } = storedConnection;
    console.log(
      `AztecWallet: Found saved connection - ${connectorId} (${walletType})`
    );

    // Find the connector
    const savedConnector = connectors.find((c) => c.id === connectorId);

    if (!savedConnector) {
      console.warn(`AztecWallet: Saved connector "${connectorId}" not found`);
      return;
    }

    // Auto-reconnect based on wallet type
    const reconnect = async () => {
      try {
        switch (walletType) {
          case WalletType.EMBEDDED:
            // For embedded, check if credentials exist
            if (walletActions.hasSavedEmbeddedAccount()) {
              console.log(
                'AztecWallet: Auto-reconnecting to embedded wallet...'
              );
              await walletActions.connectExistingEmbedded(connectorId);
            } else {
              console.warn('AztecWallet: No saved embedded credentials found');
            }
            break;

          case WalletType.EXTERNAL_SIGNER:
            // For external signer (MetaMask, etc.), try silent reconnection
            await tryExternalSignerReconnect(savedConnector, connectorId);
            break;

          case WalletType.BROWSER_WALLET:
            // For browser wallets, try to reconnect - if session exists it will be silent
            console.log('AztecWallet: Auto-reconnecting to browser wallet...');
            await walletActions.connect(connectorId);
            break;

          default:
            console.warn(`AztecWallet: Unknown wallet type: ${walletType}`);
        }
      } catch (err) {
        console.warn('AztecWallet: Auto-reconnect failed:', err);
      }
    };

    /**
     * Try to silently reconnect to an external signer wallet.
     * Uses eth_accounts (no popup) to check if we still have permissions.
     */
    const tryExternalSignerReconnect = async (
      connector: (typeof connectors)[0],
      id: string
    ) => {
      const externalConnector = connector as ExternalSignerWalletConnector;
      const rdns = externalConnector.rdns;

      if (!rdns) {
        console.log(
          'AztecWallet: External signer has no rdns, skipping auto-reconnect'
        );
        return;
      }

      // Check if the wallet is available via EIP-6963
      const eip6963 = getEIP6963Service();
      const provider = eip6963.getProviderByRdns(rdns);

      if (!provider) {
        console.log(
          `AztecWallet: Wallet ${rdns} not found via EIP-6963, cannot auto-reconnect`
        );
        return;
      }

      try {
        // Use eth_accounts to check if we have permissions (no popup)
        const accounts = (await provider.request({
          method: 'eth_accounts',
        })) as string[];

        if (accounts && accounts.length > 0) {
          console.log(
            `AztecWallet: Found existing permission for ${rdns}, auto-reconnecting...`
          );
          await walletActions.connect(id);
        } else {
          console.log(
            `AztecWallet: No existing permission for ${rdns}, user needs to reconnect manually`
          );
        }
      } catch (err) {
        console.warn(`AztecWallet: Failed to check ${rdns} permissions:`, err);
      }
    };

    reconnect();
  }, [isInitialized, isConnected, isConnecting, connectors, walletActions]);

  return null;
};

/**
 * Convert AztecWalletConfig networks to StoreNetworkPreset format for the store
 */
function toStoreNetworkPresets(
  networks: NetworkPreset[]
): StoreNetworkPreset[] {
  return networks.map((n) => ({
    aztecNetwork: n.name as AztecNetwork,
    nodeUrl: n.nodeUrl,
  }));
}

/**
 * AztecWallet Provider
 *
 * Main provider that:
 * 1. Resolves the configuration with defaults
 * 2. Auto-creates connectors from walletGroups
 * 3. Initializes network and wallet stores
 * 4. Sets up cross-tab synchronization
 * 5. Provides configuration context to components
 * 6. Renders wallet modals
 */
export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({
  config: userConfig,
  children,
}) => {
  const { setConnectors, disconnect } = useWalletStore(
    useShallow((state) => ({
      setConnectors: state.setConnectors,
      disconnect: state.disconnect,
    }))
  );
  const { initialize: initializeNetwork, resetToDefault } = useNetworkStore(
    useShallow((state) => ({
      initialize: state.initialize,
      resetToDefault: state.resetToDefault,
    }))
  );
  const currentConfig = useNetworkStore((state) => state.currentConfig);

  // Trigger EIP-6963 wallet discovery for EVM wallets
  // This populates the EVM store with discovered wallets
  const evmServiceAvailable = getEVMWalletService().isAvailable();
  useEIP6963Discovery(evmServiceAvailable);

  // Resolve config with defaults
  const resolvedConfig = useMemo(
    () => createAztecWalletConfig(userConfig),
    [userConfig]
  );

  // Initialize network store
  useEffect(() => {
    const networkPresets = toStoreNetworkPresets(userConfig.networks);

    if (!getNetworkStore().isInitialized) {
      initializeNetwork(networkPresets);
    }

    setupWalletCrossTabSync();
  }, [userConfig.networks, initializeNetwork]);

  // Validate network config
  useEffect(() => {
    if (!isValidConfig(currentConfig)) {
      console.warn(
        `⚠️ Invalid config for ${currentConfig.name}, falling back to default`
      );
      resetToDefault();
    }
  }, [currentConfig, resetToDefault]);

  // Check network availability in background when network changes
  useEffect(() => {
    if (currentConfig?.nodeUrl) {
      // Reset status and check in background (non-blocking)
      const walletStore = getWalletStore();
      walletStore.setNetworkStatus('idle');
      void walletStore.checkNetwork();
    }
  }, [currentConfig?.nodeUrl]);

  // Initialize connectors from resolved config
  useEffect(() => {
    const registry = createConnectorRegistry(resolvedConfig.connectors);
    setConnectors(registry.getConnectors());

    return () => {
      disconnect();
    };
  }, [
    resolvedConfig.connectors,
    currentConfig.nodeUrl,
    setConnectors,
    disconnect,
  ]);

  // Check if connectors are initialized
  const connectors = useWalletStore((state) => state.connectors);
  const isInitialized = connectors.length > 0;

  // Context value
  const contextValue = useMemo(
    () => ({
      config: resolvedConfig,
      isInitialized,
    }),
    [resolvedConfig, isInitialized]
  );

  return (
    <AztecWalletContext.Provider value={contextValue}>
      <AutoReconnect />
      {children}
      <AztecWalletModals />
    </AztecWalletContext.Provider>
  );
};
