import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { WalletType } from '../../types/aztec';
import { useAztecWalletContext } from '../providers/context';
import { getNetworkStore, useNetworkStore } from '../store/network';
import { useWalletStore } from '../store/wallet';

/**
 * Main hook for interacting with AztecWallet
 *
 * Provides access to wallet state and actions.
 *
 * Connection persistence:
 * - Embedded wallet credentials are always kept (even after disconnect)
 * - Active connection state is stored separately
 * - On refresh: auto-reconnects to last active connection (handled by AztecWalletProvider)
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
