import { create } from 'zustand';
import { getContractRegistryStore } from '../../../store/contractRegistry';
import { NetworkService } from '../../services/aztec/network';
import { getNetworkStore } from '../network';
import { createBrowserActions } from './actions/browser';
import { createEmbeddedActions } from './actions/embedded';
import { createExternalSignerActions } from './actions/externalSigner';
import { isValidPXETransition } from './types';
import type { WalletStore, WalletState } from './types';
import type {
  WalletConnector,
  WalletConnectorId,
} from '../../../types/walletConnector';
import type { WalletType } from '../../types/aztec';

export type { WalletStore, PXEStatus, NetworkStatus } from './types';

const WALLET_CONNECTION_STORAGE_KEY = 'aztec-wallet-connection';

interface StoredWalletConnection {
  connectorId: WalletConnectorId;
  walletType: WalletType;
}

const saveWalletConnection = (data: StoredWalletConnection): void => {
  try {
    localStorage.setItem(WALLET_CONNECTION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
};

const clearWalletConnection = (): void => {
  try {
    localStorage.removeItem(WALLET_CONNECTION_STORAGE_KEY);
  } catch {
    // Ignore
  }
};

export const getStoredWalletConnection = (): StoredWalletConnection | null => {
  try {
    const data = localStorage.getItem(WALLET_CONNECTION_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const INITIAL_STATE: WalletState = {
  account: null,
  walletType: null,
  status: 'disconnected',
  error: null,
  networkStatus: 'idle',
  networkError: null,
  pxeStatus: 'idle',
  pxeError: null,
  signerType: null,
  connectedRdns: null,
  caipAccount: null,
  caipAccounts: [],
  supportedChains: [],
  isInstalled: false,
  connectors: [],
  activeConnectorId: null,
  connectingConnectorId: null,
};

export const useWalletStore = create<WalletStore>((set, get) => ({
  ...INITIAL_STATE,

  // Shared connect orchestration
  _connectWith: async <T>(
    connectorId: WalletConnectorId,
    run: (connector: WalletConnector) => Promise<T>
  ) => {
    const connector = get().connectors.find((item) => item.id === connectorId);
    if (!connector) {
      set({
        error: `Connector "${connectorId}" not found`,
        status: 'disconnected',
        connectingConnectorId: null,
      });
      throw new Error(`Connector "${connectorId}" not found`);
    }

    if (get().connectingConnectorId === connectorId) {
      throw new Error(`Connector "${connectorId}" is already connecting`);
    }

    set({
      connectingConnectorId: connectorId,
      error: null,
    });

    try {
      const result = await run(connector);
      set({
        activeConnectorId: connector.id,
        walletType: connector.type,
        status: 'connected',
        connectingConnectorId: null,
      });
      saveWalletConnection({
        connectorId: connector.id,
        walletType: connector.type,
      });
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect to wallet';
      set({
        status: 'disconnected',
        error: message,
        activeConnectorId: null,
        walletType: null,
        connectingConnectorId: null,
      });
      throw err;
    }
  },

  _disconnectWith: async (cleanup?: () => Promise<void> | void) => {
    const { activeConnectorId, connectors } = get();
    if (!activeConnectorId) return;

    try {
      if (cleanup) {
        await cleanup();
      }
    } finally {
      clearWalletConnection();
      getContractRegistryStore().reset();
      set({
        account: null,
        walletType: null,
        status: 'disconnected',
        error: null,
        signerType: null,
        connectedRdns: null,
        caipAccount: null,
        caipAccounts: [],
        supportedChains: [],
        isInstalled: false,
        activeConnectorId: null,
        connectingConnectorId: null,
        pxeStatus: 'idle',
        pxeError: null,
        connectors,
      });
    }
  },

  setConnectors: (connectors) => set({ connectors }),

  /**
   * Generic connect method that delegates to the connector.
   *
   * NOTE: This does NOT wrap in `_connectWith` because each connector's
   * `connect()` method is responsible for calling the appropriate store action
   * (e.g., `connectEmbedded`, `connectExternalSigner`) which already uses
   * `_connectWith` internally. This avoids double-wrapping.
   */
  connect: async (connectorId) => {
    const connector = get().connectors.find((c) => c.id === connectorId);
    if (!connector) {
      set({
        error: `Connector "${connectorId}" not found`,
        status: 'disconnected',
      });
      throw new Error(`Connector "${connectorId}" not found`);
    }
    await connector.connect();
  },

  // Embedded actions
  ...createEmbeddedActions(set, get),

  // External Signer actions
  ...createExternalSignerActions(set, get),

  // Browser Wallet actions
  ...createBrowserActions(set, get),

  // Shared actions
  disconnect: async (cleanup?: () => Promise<void> | void) => {
    await get()._disconnectWith(cleanup);
  },

  setError: (error) => set({ error }),

  setNetworkStatus: (networkStatus, networkError = null) => {
    set({ networkStatus, networkError });
  },

  setPXEStatus: (pxeStatus, pxeError = null) => {
    const currentStatus = get().pxeStatus;
    if (!isValidPXETransition(currentStatus, pxeStatus)) {
      console.warn(
        `Invalid PXE state transition: ${currentStatus} → ${pxeStatus}`
      );
    }
    set({ pxeStatus, pxeError });
  },

  checkNetwork: async () => {
    const { networkStatus } = get();
    if (networkStatus === 'checking' || networkStatus === 'available') {
      return;
    }

    const { currentConfig } = getNetworkStore();
    set({ networkStatus: 'checking', networkError: null });

    try {
      await NetworkService.checkAvailability(currentConfig.nodeUrl);
      set({ networkStatus: 'available' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to connect to network';
      set({ networkStatus: 'error', networkError: message });
    }
  },

  reset: () =>
    set((state) => ({
      ...INITIAL_STATE,
      connectors: state.connectors,
    })),

  syncFromStorage: async () => {
    const { activeConnectorId, connectExistingEmbedded } = get();
    const stored = getStoredWalletConnection();

    if (stored && !activeConnectorId) {
      // Another tab connected - try to reconnect if embedded wallet
      if (stored.walletType === 'embedded') {
        try {
          await connectExistingEmbedded(stored.connectorId);
        } catch {
          // Silent fail - user can manually reconnect
        }
      }
    } else if (!stored && activeConnectorId) {
      // Another tab disconnected - clear our state
      clearWalletConnection();
      getContractRegistryStore().reset();
      set((state) => ({
        ...INITIAL_STATE,
        connectors: state.connectors,
      }));
    }
  },
}));

export const getWalletStore = () => useWalletStore.getState();

let isWalletListenerSetup = false;

export const setupWalletCrossTabSync = (): void => {
  if (isWalletListenerSetup) return;
  isWalletListenerSetup = true;

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === WALLET_CONNECTION_STORAGE_KEY) {
      getWalletStore().syncFromStorage();
    }
  });
};
