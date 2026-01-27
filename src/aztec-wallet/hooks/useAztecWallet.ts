import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { hasAppManagedPXE } from '../../types/walletConnector';
import { useAztecWalletContext } from '../providers/context';
import { getEVMWalletService } from '../services/evm/EVMWalletService';
import { getEVMStore, useEVMStore } from '../store/evm';
import {
  buildNetworkOptions,
  getNetworkStore,
  useNetworkStore,
} from '../store/network';
import { useWalletStore } from '../store/wallet';
import { WalletType } from '../types/aztec';
import type { AztecNetwork } from '../../config/networks/constants';
import type { StoreNetworkPreset } from '../types';
import type { Hex } from 'viem';

/**
 * Main hook for interacting with AztecWallet.
 *
 * Provides unified access to wallet state, connection actions, network management,
 * and EVM signer operations (for External Signer wallets).
 *
 * ## Connection Persistence
 * - Embedded wallet credentials are always kept (even after disconnect)
 * - Active connection state is stored separately in localStorage
 * - On page refresh: auto-reconnects to last active connection (handled by AztecWalletProvider)
 * - On disconnect: clears active connection but keeps embedded credentials
 *
 * ## Wallet Types
 * - **Embedded**: Keys stored in browser localStorage, managed by the app
 * - **External Signer**: Uses EVM wallet (MetaMask, etc.) for signing
 * - **Browser Wallet**: Uses external Aztec wallet extension (Azguard)
 *
 * @returns Object containing:
 *
 * **Config & Initialization**
 * - `config` - Resolved wallet configuration
 * - `isInitialized` - Whether the provider has finished initialization
 * - `isPXEInitialized` - Whether PXE is ready (always true for browser wallets)
 *
 * **Connection State**
 * - `isConnected` - Whether a wallet is connected
 * - `isConnecting` - Whether a connection is in progress
 * - `isLoading` - Whether any operation is in progress
 * - `needsSigner` - Whether External Signer needs EVM wallet connected
 * - `status` - Current connection status ('disconnected' | 'connecting' | 'deploying' | 'connected')
 * - `error` - Error message if connection failed
 * - `hasSavedAccount` - Whether there's a saved embedded account
 *
 * **Account Data**
 * - `account` - The connected AccountWithSecretKey (or null)
 * - `address` - The wallet address as string (or null)
 * - `walletType` - Current wallet type ('embedded' | 'external_signer' | 'browser_wallet')
 *
 * **Connector**
 * - `connector` - Active WalletConnector instance
 * - `connectors` - All available connectors
 * - `activeConnectorId` - ID of the active connector
 * - `connectingConnectorId` - ID of connector currently connecting
 *
 * **Network**
 * - `network` - Current network configuration
 * - `currentConfig` - Alias for network
 * - `networkName` - Current network name
 * - `networkStatus` - Network availability status ('idle' | 'checking' | 'available' | 'error')
 * - `networkError` - Network error message if status is 'error'
 * - `checkNetwork()` - Manually trigger network availability check
 *
 * **EVM Signer** (for External Signer wallet)
 * - `signer.address` - Connected EVM address
 * - `signer.isAvailable` - Whether EVM wallet is available
 * - `signer.isConnecting` - Whether EVM connection is in progress
 * - `signer.connect(rdns?)` - Connect to EVM wallet
 * - `signer.disconnect()` - Disconnect EVM wallet
 * - `signer.getService()` - Get EVMWalletService instance
 *
 * **Actions**
 * - `connect(connectorId)` - Connect to a wallet
 * - `disconnect()` - Disconnect current wallet
 * - `switchNetwork(name)` - Switch to a different network
 * - `resetToDefault()` - Reset to default network
 * - `getNetworkOptions(presets)` - Get network options for UI
 *
 * **PXE/Wallet Access** (Embedded/ExternalSigner only)
 * - `getPXE()` - Get PXE instance
 * - `getWallet()` - Get Wallet instance
 *
 * @example Basic usage
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
 *
 * @example Network switching
 * ```tsx
 * const { networkName, switchNetwork } = useAztecWallet();
 *
 * return (
 *   <select value={networkName} onChange={(e) => switchNetwork(e.target.value)}>
 *     <option value="devnet">Devnet</option>
 *     <option value="sandbox">Sandbox</option>
 *   </select>
 * );
 * ```
 *
 * @example External Signer with EVM wallet
 * ```tsx
 * const { needsSigner, signer } = useAztecWallet();
 *
 * if (needsSigner) {
 *   return (
 *     <button onClick={() => signer.connect('io.metamask')}>
 *       Connect MetaMask
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Accessing PXE for contract operations
 * ```tsx
 * const { isConnected, getPXE, connector } = useAztecWallet();
 * import { hasAppManagedPXE } from 'aztec-wallet';
 *
 * if (isConnected && hasAppManagedPXE(connector)) {
 *   const pxe = getPXE();
 *   // Use pxe for contract operations
 * }
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
      pxeStatus: state.pxeStatus,
      networkStatus: state.networkStatus,
      networkError: state.networkError,
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
      checkNetwork: state.checkNetwork,
    }))
  );

  // Network state
  const networkState = useNetworkStore(
    useShallow((state) => ({
      currentConfig: state.currentConfig,
      configuredNetworks: state.configuredNetworks,
      resetToDefault: state.resetToDefault,
    }))
  );

  // EVM state (for External Signer)
  const evmState = useEVMStore(
    useShallow((state) => ({
      address: state.address,
      isAvailable: state.isAvailable,
      isConnecting: state.isConnecting,
    }))
  );

  // Derived state
  const isConnected = walletState.status === 'connected';
  const isConnecting =
    walletState.status === 'connecting' || walletState.status === 'deploying';
  const isLoading = isConnecting || walletState.connectingConnectorId !== null;
  const address = walletState.account?.getAddress().toString() ?? null;

  // PXE initialization state (for Embedded/ExternalSigner)
  // Browser wallets manage their own PXE, so they're considered initialized immediately
  const isPXEInitialized =
    walletState.pxeStatus === 'ready' ||
    walletState.walletType === WalletType.BROWSER_WALLET;

  // Whether an EVM signer is needed but not connected
  const needsSigner =
    walletState.walletType === WalletType.EXTERNAL_SIGNER &&
    evmState.address === null;

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
  const switchNetwork = useCallback(async (networkName: AztecNetwork) => {
    const networkStore = getNetworkStore();
    networkStore.switchToNetwork(networkName);
  }, []);

  // Reset to default network
  const resetToDefault = useCallback(() => {
    networkState.resetToDefault();
  }, [networkState]);

  // EVM Signer operations (for External Signer wallet)
  const signerConnect = useCallback(
    async (rdns?: string): Promise<Hex | undefined> => {
      const evmService = getEVMWalletService();
      getEVMStore().setConnecting(true);
      getEVMStore().setError(null);

      try {
        const address = await evmService.connect(undefined, rdns);
        getEVMStore().setAddress(address);
        return address;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to connect';
        getEVMStore().setError(message);
        return undefined;
      } finally {
        getEVMStore().setConnecting(false);
      }
    },
    []
  );

  const signerDisconnect = useCallback(() => {
    const evmService = getEVMWalletService();
    evmService.disconnect();
    getEVMStore().reset();
  }, []);

  // Signer object for External Signer wallet
  const signer = useMemo(
    () => ({
      address: evmState.address,
      isAvailable: evmState.isAvailable,
      isConnecting: evmState.isConnecting,
      connect: signerConnect,
      disconnect: signerDisconnect,
      getService: getEVMWalletService,
    }),
    [
      evmState.address,
      evmState.isAvailable,
      evmState.isConnecting,
      signerConnect,
      signerDisconnect,
    ]
  );

  // Get PXE instance (only for Embedded/ExternalSigner)
  const getPXE = useCallback(() => {
    if (connector && hasAppManagedPXE(connector)) {
      return connector.getPXE();
    }
    return null;
  }, [connector]);

  // Get Wallet instance (only for Embedded/ExternalSigner)
  const getWallet = useCallback(() => {
    if (connector && hasAppManagedPXE(connector)) {
      return connector.getWallet();
    }
    return null;
  }, [connector]);

  // Get network options for UI dropdowns
  // Note: Requires network presets to be passed or cached
  const getNetworkOptions = useCallback(
    (presets: StoreNetworkPreset[]) => {
      return buildNetworkOptions(networkState.configuredNetworks, presets);
    },
    [networkState.configuredNetworks]
  );

  return {
    // Config
    config,

    // Initialization state
    isInitialized,
    isPXEInitialized,

    // Connection state
    isConnected,
    isConnecting,
    isLoading,
    needsSigner,
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
    /** @alias network - for convenience */
    currentConfig: networkState.currentConfig,
    networkName: networkState.currentConfig?.name,

    // Network availability (checked in background)
    networkStatus: walletState.networkStatus,
    networkError: walletState.networkError,
    checkNetwork: walletActions.checkNetwork,

    // EVM Signer (for External Signer wallet)
    signer,

    // Actions
    connect,
    disconnect,
    switchNetwork,
    resetToDefault,
    getNetworkOptions,

    // PXE/Wallet access (for Embedded/ExternalSigner)
    getPXE,
    getWallet,
  };
}
