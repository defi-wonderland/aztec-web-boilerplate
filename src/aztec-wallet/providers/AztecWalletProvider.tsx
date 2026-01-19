import React, { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { WalletType } from '../../types/aztec';
import { AztecWalletModals } from '../components/AztecWalletModals';
import { createAztecWalletConfig } from '../config';
import { useEIP6963Discovery } from '../hooks/useEIP6963Discovery';
import { getEIP6963Service, getEVMWalletService } from '../services/evm';
import { useWalletStore, getStoredWalletConnection } from '../store/wallet';
import { AztecWalletContext } from './context';
import type { ExternalSignerWalletConnector } from '../../types/walletConnector';
import type { AztecWalletConfig } from '../types';

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
            // Browser wallets need manual reconnection
            console.log(
              'AztecWallet: Browser wallet was connected, user needs to reconnect manually'
            );
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
 * AztecWallet Provider
 *
 * Lightweight provider that:
 * 1. Resolves the configuration with defaults
 * 2. Provides configuration context to components
 *
 * NOTE: This provider does NOT initialize connectors.
 * Connectors are initialized by UniversalWalletProvider.
 * This provider only provides the UI configuration for AztecWallet components.
 */
export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({
  config: userConfig,
  children,
}) => {
  // Trigger EIP-6963 wallet discovery for EVM wallets
  // This populates the EVM store with discovered wallets
  const evmServiceAvailable = getEVMWalletService().isAvailable();
  useEIP6963Discovery(evmServiceAvailable);

  // Resolve config with defaults
  const resolvedConfig = useMemo(
    () => createAztecWalletConfig(userConfig),
    [userConfig]
  );

  // Check if connectors are already initialized (by UniversalWalletProvider)
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
