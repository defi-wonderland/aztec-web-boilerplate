import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { WalletType } from '../../types/aztec';
import { useAztecWalletContext } from '../providers/context';
import { getEIP6963Service } from '../services/evm';
import { getNetworkStore, useNetworkStore } from '../store/network';
import { useWalletStore, getStoredWalletConnection } from '../store/wallet';
import type { ExternalSignerWalletConnector } from '../../types/walletConnector';

/**
 * Main hook for interacting with AztecWallet
 *
 * Provides access to wallet state and actions.
 * Automatically reconnects to the last connected wallet on mount.
 *
 * Connection persistence:
 * - Embedded wallet credentials are always kept (even after disconnect)
 * - Active connection state is stored separately
 * - On refresh: reconnects to last active connection
 * - On disconnect: clears active connection but keeps embedded credentials
 *
 * @example
 * ```tsx
 * const { isConnected, address, connect, disconnect } = useAztecWallet();
 *
 * if (!isConnected) {
 *   return <button onClick={() => connect('embedded')}>Connect</button>;
 * }
 *
 * return (
 *   <div>
 *     Connected: {address}
 *     <button onClick={disconnect}>Disconnect</button>
 *   </div>
 * );
 * ```
 */
export function useAztecWallet() {
  const { config, isInitialized } = useAztecWalletContext();
  const connectingRef = useRef(false);
  const autoConnectAttempted = useRef(false);

  // Wallet state from store
  const walletState = useWalletStore(
    useShallow((state) => ({
      account: state.account,
      status: state.status,
      walletType: state.walletType,
      error: state.error,
      activeConnectorId: state.activeConnectorId,
      connectingConnectorId: state.connectingConnectorId,
      connectors: state.connectors,
    }))
  );

  // Wallet actions from store
  const walletActions = useWalletStore(
    useShallow((state) => ({
      connect: state.connect,
      connectEmbedded: state.connectEmbedded,
      connectExistingEmbedded: state.connectExistingEmbedded,
      hasSavedEmbeddedAccount: state.hasSavedEmbeddedAccount,
      connectExternalSigner: state.connectExternalSigner,
      connectBrowserWallet: state.connectBrowserWallet,
      disconnect: state.disconnect,
    }))
  );

  // Network state
  const networkState = useNetworkStore(
    useShallow((state) => ({
      currentConfig: state.currentConfig,
    }))
  );

  // Derived state
  const isConnected = walletState.status === 'connected';
  const isConnecting =
    walletState.status === 'connecting' || walletState.status === 'deploying';
  const address = walletState.account?.getAddress().toString() ?? null;

  // Check if there's a saved embedded account
  const hasSavedAccount = walletActions.hasSavedEmbeddedAccount();

  // Get active connector
  const connector = useMemo(() => {
    if (!walletState.activeConnectorId) return null;
    return (
      walletState.connectors.find(
        (c) => c.id === walletState.activeConnectorId
      ) ?? null
    );
  }, [walletState.activeConnectorId, walletState.connectors]);

  // Find connector by ID
  const findConnector = useCallback(
    (connectorId: string) => {
      return walletState.connectors.find((c) => c.id === connectorId);
    },
    [walletState.connectors]
  );

  // Connect to a wallet by ID
  // For embedded: automatically uses existing account if available
  const connect = useCallback(
    async (connectorId: string) => {
      // Prevent duplicate connection attempts
      if (connectingRef.current) {
        console.warn('Connection already in progress');
        return;
      }

      const foundConnector = findConnector(connectorId);
      if (!foundConnector) {
        console.error(`Connector "${connectorId}" not found`);
        return;
      }

      connectingRef.current = true;

      try {
        // Use the appropriate connection method based on connector type
        switch (foundConnector.type) {
          case WalletType.EMBEDDED:
            // If there's a saved account, use it. Otherwise create new.
            if (walletActions.hasSavedEmbeddedAccount()) {
              await walletActions.connectExistingEmbedded(connectorId);
            } else {
              await walletActions.connectEmbedded(connectorId);
            }
            break;

          case WalletType.EXTERNAL_SIGNER:
            await walletActions.connect(connectorId);
            break;

          case WalletType.BROWSER_WALLET:
            await walletActions.connect(connectorId);
            break;

          default:
            await walletActions.connect(connectorId);
        }
      } finally {
        connectingRef.current = false;
      }
    },
    [findConnector, walletActions]
  );

  // Auto-reconnect to last connected wallet on mount
  useEffect(() => {
    // Only attempt once, when initialized, and not already connected
    if (
      autoConnectAttempted.current ||
      !isInitialized ||
      isConnected ||
      isConnecting ||
      walletState.connectors.length === 0
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
    const savedConnector = walletState.connectors.find(
      (c) => c.id === connectorId
    );

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
            // using eth_accounts (doesn't trigger popup if already authorized)
            await tryExternalSignerReconnect(savedConnector, connectorId);
            break;

          case WalletType.BROWSER_WALLET:
            // Browser wallets also need manual reconnection
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
      connector: (typeof walletState.connectors)[0],
      id: string
    ) => {
      // Get the rdns from the connector if available
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
          // We have permission, proceed with full connection
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
  }, [
    isInitialized,
    isConnected,
    isConnecting,
    walletState.connectors,
    walletActions,
  ]);

  // Disconnect current wallet
  const disconnect = useCallback(async () => {
    await walletActions.disconnect();
  }, [walletActions]);

  // Switch network
  const switchNetwork = useCallback(async (networkName: string) => {
    const networkStore = getNetworkStore();
    networkStore.switchToNetwork(networkName);
  }, []);

  return {
    // Config
    config,

    // Initialization state
    isInitialized,

    // Connection state
    isConnected,
    isConnecting,
    status: walletState.status,
    error: walletState.error,

    // Saved account info
    hasSavedAccount,

    // Account data
    account: walletState.account,
    address,
    walletType: walletState.walletType,

    // Connector
    connector,
    connectors: walletState.connectors,
    activeConnectorId: walletState.activeConnectorId,
    connectingConnectorId: walletState.connectingConnectorId,

    // Network
    network: networkState.currentConfig,
    networkName: networkState.currentConfig?.name,

    // Actions
    connect,
    disconnect,
    switchNetwork,
  };
}
