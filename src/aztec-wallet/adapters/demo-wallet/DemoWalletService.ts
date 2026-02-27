/**
 * DemoWalletService - Wrapper around @aztec/wallet-sdk for demo-wallet (Aztec Keychain)
 *
 * Handles wallet discovery, secure channel establishment, and connection lifecycle.
 * The demo-wallet is an Electron app + browser extension that communicates via
 * the wallet-sdk protocol (discovery → key exchange → emoji verification → connection).
 */

import type { Wallet } from '@aztec/aztec.js/wallet';
import type { ChainInfo } from '@aztec/aztec.js/account';
import type {
  WalletProvider,
  PendingConnection,
} from '@aztec/wallet-sdk/manager';

const DISCOVERY_TIMEOUT = 30_000; // 30s default

export class DemoWalletService {
  private wallet: Wallet | null = null;
  private provider: WalletProvider | null = null;
  private disconnectCallbacks: Array<() => void> = [];
  private unsubDisconnect: (() => void) | null = null;

  /**
   * Discover available wallet providers on the network.
   * Returns the first discovered provider, or throws on timeout.
   */
  async discover(
    chainInfo: ChainInfo,
    appId: string,
    timeout = DISCOVERY_TIMEOUT
  ): Promise<WalletProvider> {
    const { WalletManager } = await import('@aztec/wallet-sdk/manager');

    const manager = WalletManager.configure({
      extensions: { enabled: true },
    });

    const discovery = manager.getAvailableWallets({
      chainInfo,
      appId,
      timeout,
    });

    // Take the first discovered wallet
    for await (const provider of discovery.wallets) {
      discovery.cancel();
      this.provider = provider;
      return provider;
    }

    throw new Error(
      'No Aztec Keychain wallet found. Make sure the Aztec Keychain app is running and the browser extension is installed.'
    );
  }

  /**
   * Establish a secure channel with the wallet provider.
   * Returns a PendingConnection with verificationHash for emoji verification.
   */
  async establishSecureChannel(
    provider: WalletProvider,
    appId: string
  ): Promise<PendingConnection> {
    return provider.establishSecureChannel(appId);
  }

  /**
   * Confirm a pending connection after emoji verification.
   * Returns the connected Wallet instance.
   */
  async confirmConnection(pending: PendingConnection): Promise<Wallet> {
    const wallet = await pending.confirm();
    this.wallet = wallet;

    // Subscribe to disconnection events from the provider
    if (this.provider?.onDisconnect) {
      this.unsubDisconnect = this.provider.onDisconnect(() => {
        this.wallet = null;
        for (const cb of this.disconnectCallbacks) {
          cb();
        }
      });
    }

    return wallet;
  }

  /**
   * Cancel a pending connection.
   */
  cancelConnection(pending: PendingConnection): void {
    pending.cancel();
  }

  /**
   * Get the connected wallet instance.
   */
  getWallet(): Wallet | null {
    return this.wallet;
  }

  /**
   * Register a callback for disconnection events.
   */
  onDisconnected(cb: () => void): void {
    this.disconnectCallbacks.push(cb);
  }

  /**
   * Disconnect and clean up resources.
   */
  async disconnect(): Promise<void> {
    if (this.provider?.disconnect) {
      await this.provider.disconnect();
    }
    this.wallet = null;
    this.provider = null;
    if (this.unsubDisconnect) {
      this.unsubDisconnect();
      this.unsubDisconnect = null;
    }
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.wallet = null;
    this.provider = null;
    this.disconnectCallbacks = [];
    if (this.unsubDisconnect) {
      this.unsubDisconnect();
      this.unsubDisconnect = null;
    }
  }
}
