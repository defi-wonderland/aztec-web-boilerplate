/**
 * BrowserWalletConnector - Connector for Browser Wallet extensions via wallet-sdk
 *
 * Uses @aztec/wallet-sdk for wallet discovery and secure connection.
 * connect() performs the full flow automatically (discover + auto-confirm).
 *
 * For advanced use cases requiring manual emoji verification, the two-phase
 * flow is still available:
 *   1. startConnect() - discovers wallet, performs key exchange, returns emoji data
 *   2. confirmConnect() - user confirms emojis match, finalizes connection
 *
 * After connection, getWallet() returns a standard Wallet interface.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { hashToEmoji } from '@aztec/wallet-sdk/crypto';
import {
  WalletManager,
  type WalletProvider,
  type PendingConnection,
} from '@aztec/wallet-sdk/manager';
import { getNetworkStore } from '../store/network';
import { getWalletStore } from '../store/wallet';
import { WalletType } from '../types/aztec';
import type {
  BrowserWalletConnector as IBrowserWalletConnector,
  ConnectorStatus,
} from '../types/walletConnector';

const APP_ID = 'aztec-web-boilerplate';

/** Discovery timeout in milliseconds */
const DISCOVERY_TIMEOUT_MS = 30_000;

export interface EmojiVerificationData {
  emojis: string;
  walletName: string;
  walletIcon?: string;
}

interface BrowserWalletConnectorConfig {
  id: string;
  label: string;
  providerId: string;
}

/**
 * Connector for Browser Wallet extensions (Azguard, etc.) using @aztec/wallet-sdk.
 *
 * These wallets have their own PXE running in the extension.
 * Communication is handled via wallet-sdk's secure channel protocol.
 */
export class BrowserWalletConnector implements IBrowserWalletConnector {
  readonly id: string;
  readonly label: string;
  readonly type = WalletType.BROWSER_WALLET;
  readonly providerId: string;

  private _wallet: Wallet | null = null;
  // Cached from wallet.getAccounts() after confirmConnect(). The execution
  // client needs synchronous access to the active address via getAddress(),
  // but wallet-sdk's Wallet.getAccounts() is async.
  private _address: AztecAddress | null = null;
  private _provider: WalletProvider | null = null;
  private _pendingConnection: PendingConnection | null = null;
  private _unsubDisconnect: (() => void) | null = null;

  constructor(config: BrowserWalletConnectorConfig) {
    this.id = config.id;
    this.label = config.label;
    this.providerId = config.providerId;
  }

  getStatus(): ConnectorStatus {
    const state = getWalletStore();
    const isBrowserWallet = state.walletType === WalletType.BROWSER_WALLET;

    return {
      isInstalled: isBrowserWallet ? state.isInstalled : false,
      status: isBrowserWallet ? state.status : 'disconnected',
      error: isBrowserWallet ? state.error : null,
    };
  }

  // Browser wallets don't expose secret keys; use getAddress() instead.
  getAccount(): AccountWithSecretKey | null {
    return null;
  }

  getAddress(): AztecAddress | null {
    return this._address;
  }

  getWallet(): Wallet | null {
    return this._wallet;
  }

  /**
   * Phase 1: Discover wallet provider and establish secure channel.
   * Returns emoji verification data for the user to confirm.
   */
  async startConnect(): Promise<EmojiVerificationData> {
    const config = getNetworkStore().currentConfig;

    // Get chain info from the Aztec node
    const nodeClient = createAztecNodeClient(config.nodeUrl);
    const nodeInfo = await nodeClient.getNodeInfo();
    const chainInfo = {
      chainId: new Fr(nodeInfo.l1ChainId),
      version: new Fr(nodeInfo.rollupVersion),
    };

    // Configure the WalletManager for extension discovery
    const manager = WalletManager.configure({
      extensions: { enabled: true },
    });

    // Discover wallets matching our providerId
    const discovery = manager.getAvailableWallets({
      chainInfo,
      appId: APP_ID,
      timeout: DISCOVERY_TIMEOUT_MS,
    });

    let matchedProvider: WalletProvider | null = null;

    for await (const provider of discovery.wallets) {
      if (provider.id === this.providerId) {
        matchedProvider = provider;
        discovery.cancel();
        break;
      }
    }

    if (!matchedProvider) {
      throw new Error(
        `Wallet "${this.label}" not found. Make sure the extension is installed and enabled.`
      );
    }

    this._provider = matchedProvider;

    // Establish secure channel (ECDH key exchange)
    const pending = await matchedProvider.establishSecureChannel(APP_ID);
    this._pendingConnection = pending;

    // Convert verification hash to emojis for user display
    const emojis = hashToEmoji(pending.verificationHash);

    return {
      emojis,
      walletName: matchedProvider.name,
      walletIcon: matchedProvider.icon,
    };
  }

  /**
   * Phase 2: User confirmed emojis match. Finalize the connection.
   */
  async confirmConnect(): Promise<void> {
    if (!this._pendingConnection) {
      throw new Error('No pending connection. Call startConnect() first.');
    }

    const wallet = await this._pendingConnection.confirm();
    this._wallet = wallet;
    this._pendingConnection = null;

    // Fetch the active account address from the wallet for downstream execution
    const accounts = await wallet.getAccounts();
    if (accounts.length === 0) {
      throw new Error('Connected wallet has no accounts');
    }
    this._address = accounts[0].item;

    // Listen for disconnect events from the wallet
    if (this._provider) {
      this._unsubDisconnect = this._provider.onDisconnect(() => {
        void this.handleWalletDisconnect();
      });
    }
  }

  /**
   * Cancel a pending connection (user rejected emoji verification).
   */
  cancelConnect(): void {
    if (this._pendingConnection) {
      this._pendingConnection.cancel();
      this._pendingConnection = null;
    }
  }

  // Goes through _connectWith so the store orchestrates the state machine
  // (status: connecting → connected/disconnected) around the wallet-sdk
  // handshake. Without this wrapper the handshake succeeds but the global
  // wallet state stays 'disconnected' and the execution client is never built.
  async connect(): Promise<void> {
    const store = getWalletStore();
    await store._connectWith(this.id, async () => {
      // Only flag as installed after discovery succeeds; otherwise a failed
      // connect (no extension) would leave the store reporting isInstalled=true.
      await this.startConnect();
      store.setBrowserWalletState({ isInstalled: true });
      await this.confirmConnect();
    });
  }

  async disconnect(): Promise<void> {
    await getWalletStore().disconnect(async () => {
      await this.cleanup();
    });
  }

  private async cleanup(): Promise<void> {
    if (this._unsubDisconnect) {
      this._unsubDisconnect();
      this._unsubDisconnect = null;
    }

    if (this._provider) {
      try {
        await this._provider.disconnect();
      } catch {
        // Ignore disconnect errors during cleanup
      }
      this._provider = null;
    }

    this._wallet = null;
    this._address = null;
    this._pendingConnection = null;
  }

  private async handleWalletDisconnect(): Promise<void> {
    this._wallet = null;
    this._address = null;
    this._provider = null;

    if (this._unsubDisconnect) {
      this._unsubDisconnect();
      this._unsubDisconnect = null;
    }

    await getWalletStore().disconnect();
  }
}
