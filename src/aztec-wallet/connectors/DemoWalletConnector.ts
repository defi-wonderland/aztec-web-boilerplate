/**
 * DemoWalletConnector - Connector for Aztec Keychain (demo-wallet)
 *
 * Unlike BrowserWalletConnector (which uses executeOperations for contract interactions),
 * this connector exposes a full Wallet proxy from the demo-wallet.
 * Contract interactions go through wallet.methods.xxx() directly.
 *
 * The connection flow includes an emoji verification step coordinated
 * via the verification store.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { getNetworkStore } from '../store/network';
import { getWalletStore } from '../store/wallet';
import { WalletType } from '../types/aztec';
import type {
  IBrowserWalletAdapter,
  BrowserWalletAdapterFactory,
} from '../../types/browserWallet';
import type {
  WalletConnector,
  ConnectorStatus,
  WalletConnectorId,
} from '../../types/walletConnector';
import { clearDemoWalletRegistrationCache } from '../../hooks/contracts/demoWalletRegistration';
import type { DemoWalletAdapter } from '../adapters/demo-wallet';

interface DemoWalletConnectorConfig {
  id: string;
  label: string;
  adapterFactory: BrowserWalletAdapterFactory;
}

/**
 * Connector for Aztec Keychain (demo-wallet).
 *
 * Key differences from BrowserWalletConnector:
 * - Exposes getWallet() for direct contract interactions
 * - Connection includes emoji verification step
 * - Does not support executeOperations/sendTransaction
 */
export class DemoWalletConnector implements WalletConnector {
  readonly id: WalletConnectorId;
  readonly label: string;
  readonly type = WalletType.BROWSER_WALLET;

  private adapterFactory: BrowserWalletAdapterFactory;
  private _adapter: IBrowserWalletAdapter | null = null;
  private _initPromise: Promise<void> | null = null;

  constructor(config: DemoWalletConnectorConfig) {
    this.id = config.id;
    this.label = config.label;
    this.adapterFactory = config.adapterFactory;

    // Start initialization (non-blocking, for consistency)
    void this.ensureInitialized().catch((error) => {
      console.warn(
        `[DemoWalletConnector:${this.id}] initialize failed`,
        error
      );
    });
  }

  private async getAdapter(): Promise<DemoWalletAdapter> {
    if (!this._adapter) {
      this._adapter = await this.adapterFactory();
    }
    return this._adapter as DemoWalletAdapter;
  }

  private async initialize(): Promise<void> {
    const adapter = await this.getAdapter();
    await adapter.initialize();

    adapter.onAccountsChanged(async (accounts) => {
      const selectedAccount = accounts.length > 0 ? accounts[0] : null;
      const store = getWalletStore();

      store.setBrowserWalletState({
        caipAccounts: accounts,
        caipAccount: selectedAccount,
      });

      if (selectedAccount) {
        try {
          const accountWallet = await adapter.toAccountWallet(selectedAccount);
          store.setBrowserWalletState({ account: accountWallet });
        } catch {
          store.setBrowserWalletState({ account: null });
        }
      } else {
        store.setBrowserWalletState({ account: null });
      }
    });

    adapter.onDisconnected(async () => {
      await getWalletStore().disconnect();
    });
  }

  private ensureInitialized(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = this.initialize().catch((error) => {
        this._initPromise = null;
        throw error;
      });
    }
    return this._initPromise;
  }

  destroy(): void {
    if (this._adapter) {
      this._adapter.destroy();
      this._adapter = null;
      this._initPromise = null;
    }
  }

  getStatus(): ConnectorStatus {
    const state = getWalletStore();
    const isBrowserWallet = state.walletType === WalletType.BROWSER_WALLET;

    return {
      // demo-wallet extension can't be detected synchronously
      isInstalled: true,
      status: isBrowserWallet ? state.status : 'disconnected',
      error: isBrowserWallet ? state.error : null,
    };
  }

  getAccount(): AccountWithSecretKey | null {
    const state = getWalletStore();
    if (state.walletType === WalletType.BROWSER_WALLET) {
      return state.account;
    }
    return null;
  }

  async connect(): Promise<void> {
    await this.ensureInitialized();

    const adapter = await this.getAdapter();
    const config = getNetworkStore().currentConfig;
    await getWalletStore().connectBrowserWallet(adapter, config.name, this.id);
  }

  async disconnect(): Promise<void> {
    const adapter = this._adapter;
    await getWalletStore().disconnect(async () => {
      if (adapter) {
        await adapter.disconnect();
        adapter.destroy();
      }
      this._adapter = null;
      this._initPromise = null;
      clearDemoWalletRegistrationCache();
    });
  }

  /**
   * Get the connected Wallet proxy for direct contract interactions.
   * Returns null if not connected.
   */
  getWallet(): Wallet | null {
    const adapter = this._adapter as DemoWalletAdapter | null;
    return adapter?.getConnectedWallet() ?? null;
  }
}
