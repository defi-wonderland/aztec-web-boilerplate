// Zustand store for wallet connection state.
// Keep the store focused on state + actions; no UI here.
//
// DESIGN DECISION (external handshake / emoji grid):
// The external connector surfaces an emoji grid mid-connect() for the user to
// compare against their wallet. It is DISPLAY-ONLY (no confirm button): the
// connector proceeds straight to confirm(), which triggers the wallet's own
// popup. The store exposes the grid as `emojiGrid` and clears it once the
// connection settles, so the UI just shows a dialog while `emojiGrid !== null`.
// The embedded connector never sets it. The store owns the callback internally.
import { create } from 'zustand';
import type { AztecNode } from '@aztec/aztec.js/node';
import type { Wallet, Aliased } from '@aztec/aztec.js/wallet';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { createNode } from '../services/node';
import { getConnector } from '../lib/connectors';
import type { ConnectorKind } from '../lib/connectors/types';
import { DEFAULT_NETWORK_ID, getNetwork } from '../config/app';

// Persist WHICH connector was last used so we can auto-reconnect on reload.
// The embedded account already lives in IndexedDB (ephemeral: false), so
// reconnecting embedded recovers the same account without creating a new one.
const LAST_CONNECTOR_KEY = 'web-boiler:lastConnector';
const NETWORK_KEY = 'web-boiler:network';

function readNetworkId(): string {
  try {
    return localStorage.getItem(NETWORK_KEY) ?? DEFAULT_NETWORK_ID;
  } catch {
    return DEFAULT_NETWORK_ID;
  }
}

function writeNetworkId(id: string) {
  try {
    localStorage.setItem(NETWORK_KEY, id);
  } catch {
    // ignore: localStorage unavailable
  }
}

function readLastConnector(): ConnectorKind | null {
  try {
    const v = localStorage.getItem(LAST_CONNECTOR_KEY);
    return v === 'embedded' || v === 'external' ? v : null;
  } catch {
    return null; // localStorage unavailable (private mode, etc.)
  }
}

function writeLastConnector(kind: ConnectorKind | null) {
  try {
    if (kind) localStorage.setItem(LAST_CONNECTOR_KEY, kind);
    else localStorage.removeItem(LAST_CONNECTOR_KEY);
  } catch {
    // ignore: localStorage unavailable
  }
}

function logConnectorDisconnectError(err: unknown) {
  console.warn('Failed to disconnect wallet connector', err);
}

async function disconnectConnector(kind: ConnectorKind | null) {
  if (!kind) return;
  const connector = getConnector(kind);
  await connector?.disconnect();
}

// 'selecting' = connected to the wallet, but the user still has to pick which
// granted account to use (only when the wallet exposed more than one).
export type WalletStatus = 'idle' | 'connecting' | 'selecting' | 'connected' | 'error';

export interface WalletState {
  node: AztecNode | null;
  /** Active network id (see NETWORKS in config/app). */
  networkId: string;
  status: WalletStatus;
  connector: ConnectorKind | null;
  address: AztecAddress | null;
  wallet: Wallet | null;
  error: string | null;
  /** Emoji grid to display during the external handshake; null when no dialog. */
  emojiGrid: string | null;
  /** Accounts to choose from while status === 'selecting'; null otherwise. */
  pendingAccounts: Aliased<AztecAddress>[] | null;
  /** Monotonic token used to ignore stale async connection completions. */
  connectAttemptId: number;
  /** Teardown for the exact active wallet/provider session. */
  walletDisconnect: (() => Promise<void>) | null;

  /**
   * Create the node client for the persisted (or default) network and store it.
   * Idempotent: reuses an existing node. Call once on app load.
   */
  initNetwork: () => void;
  /**
   * Switch to another network: recreates the node client and tears down any
   * active wallet (chainInfo differs per network, so the session can't carry over).
   */
  setNetwork: (id: string) => void;
  /**
   * Connect using the given connector. The external connector surfaces an emoji
   * grid via `emojiGrid` (display-only) while the wallet prompts; embedded does not.
   * If the wallet exposes >1 account, transitions to 'selecting' for the user to
   * pick (via `selectAccount`); a single account is selected automatically.
   */
  connect: (kind: ConnectorKind) => Promise<void>;
  /** Finalize a 'selecting' connection by choosing one of the pending accounts. */
  selectAccount: (address: AztecAddress) => void;
  /** Disconnect the active connector and reset wallet state. */
  disconnect: () => void;
  /**
   * Auto-reconnect on load if the last session was embedded. Embedded-only:
   * external requires a re-handshake (secure channel destroyed on reload) and
   * we don't want to trigger the emoji flow without the user asking. Requires
   * `initNetwork` to have run first.
   */
  reconnect: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  node: null,
  networkId: DEFAULT_NETWORK_ID,
  status: 'idle',
  connector: null,
  address: null,
  wallet: null,
  error: null,
  emojiGrid: null,
  pendingAccounts: null,
  connectAttemptId: 0,
  walletDisconnect: null,

  initNetwork: () => {
    if (get().node) return;
    const net = getNetwork(readNetworkId());
    set({ node: createNode(net.nodeUrl), networkId: net.id });
  },

  setNetwork: (id) => {
    if (id === get().networkId && get().node) return;
    const net = getNetwork(id);
    // Tear down any active wallet first (resets state + clears lastConnector).
    get().disconnect();
    writeNetworkId(net.id);
    set({ node: createNode(net.nodeUrl), networkId: net.id });
  },

  connect: async (kind) => {
    const node = get().node;
    if (!node) {
      set({ status: 'error', error: 'Node not initialized' });
      return;
    }
    const connector = getConnector(kind);
    if (!connector) {
      set({ status: 'error', error: `Unknown connector: ${kind}` });
      return;
    }

    const previousConnector = get().connector;
    const previousWalletDisconnect = get().walletDisconnect;
    const attemptId = get().connectAttemptId + 1;
    set({
      connectAttemptId: attemptId,
      status: 'connecting',
      connector: kind,
      wallet: null,
      address: null,
      error: null,
      emojiGrid: null,
      pendingAccounts: null,
      walletDisconnect: null,
    });

    const isCurrentAttempt = () => {
      const state = get();
      return (
        state.connectAttemptId === attemptId &&
        state.status === 'connecting' &&
        state.connector === kind &&
        state.node === node
      );
    };

    try {
      if (previousWalletDisconnect) {
        await previousWalletDisconnect().catch(logConnectorDisconnectError);
        if (!isCurrentAttempt()) return;
      } else if (previousConnector) {
        await disconnectConnector(previousConnector).catch(logConnectorDisconnectError);
        if (!isCurrentAttempt()) return;
      }

      const { wallet, accounts, disconnect } = await connector.connect({
        node,
        // Display-only: show the grid; the connector proceeds to the wallet popup.
        onEmojiGrid: (grid) => {
          if (isCurrentAttempt()) set({ emojiGrid: grid });
        },
      });

      if (!isCurrentAttempt()) {
        await disconnect().catch(logConnectorDisconnectError);
        return;
      }

      if (accounts.length === 0) {
        await disconnect().catch(logConnectorDisconnectError);
        if (!isCurrentAttempt()) return;
        set({
          status: 'error',
          error: 'No accounts available',
          wallet: null,
          address: null,
          emojiGrid: null,
          walletDisconnect: null,
        });
        return;
      }

      // Keep the wallet either way; a single account is auto-selected, while
      // several move to 'selecting' so the user picks one.
      if (accounts.length === 1) {
        writeLastConnector(kind);
        set({
          status: 'connected',
          wallet,
          address: accounts[0].item,
          error: null,
          emojiGrid: null,
          pendingAccounts: null,
          walletDisconnect: disconnect,
        });
      } else {
        set({
          status: 'selecting',
          wallet,
          pendingAccounts: accounts,
          error: null,
          emojiGrid: null,
          walletDisconnect: disconnect,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isCurrentAttempt()) return;
      set({
        status: 'error',
        error: message,
        wallet: null,
        address: null,
        emojiGrid: null,
        pendingAccounts: null,
        walletDisconnect: null,
      });
    }
  },

  selectAccount: (address) => {
    const { status, connector, pendingAccounts } = get();
    if (status !== 'selecting') return;
    if (!pendingAccounts?.some((account) => account.item.equals(address))) {
      set({ status: 'error', error: 'Selected account was not granted by the wallet' });
      return;
    }
    if (connector) writeLastConnector(connector);
    set({ status: 'connected', address, pendingAccounts: null, error: null });
  },

  disconnect: () => {
    const { connector, connectAttemptId, walletDisconnect } = get();
    const disconnect = walletDisconnect ?? (() => disconnectConnector(connector));
    void disconnect().catch(logConnectorDisconnectError);
    writeLastConnector(null);
    set({
      connectAttemptId: connectAttemptId + 1,
      status: 'idle',
      connector: null,
      wallet: null,
      address: null,
      error: null,
      emojiGrid: null,
      pendingAccounts: null,
      walletDisconnect: null,
    });
  },

  reconnect: async () => {
    const { status, node } = get();
    if (status === 'connecting' || status === 'selecting' || status === 'connected') return;
    if (!node) return; // initNetwork must have run first
    if (readLastConnector() !== 'embedded') return;

    await get().connect('embedded');
    // connect() doesn't throw: it sets status 'error'. If it failed, clear the
    // flag so we don't retry-and-re-error on every reload.
    if (get().status === 'error') writeLastConnector(null);
  },
}));
