/**
 * BrowserWalletConnector - Connector for Browser Wallet extensions
 *
 * Uses external PXE (browser extension manages everything).
 * Supports any wallet that implements IBrowserWalletAdapter.
 * Self-contained: handles adapter initialization and event listeners internally.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { getNetworkStore } from '../store/network';
import { getWalletStore } from '../store/wallet';
import { WalletType } from '../types/aztec';
import type {
  IBrowserWalletAdapter,
  BrowserWalletAdapterFactory,
  BrowserWalletOperation,
  BrowserWalletOperationResult,
  SendTransactionOp,
  ContractCall,
} from '../../types/browserWallet';
import type {
  BrowserWalletConnector as IBrowserWalletConnector,
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../../types/walletConnector';
import type { CaipAccount } from '@azguardwallet/types';

const toContractCall = (
  action: ConnectorTransactionRequest['actions'][number]
): ContractCall => ({
  kind: 'call',
  contract: action.contract,
  method: action.method,
  args: action.args,
});

interface BrowserWalletConnectorConfig {
  id: string;
  label: string;
  adapterFactory: BrowserWalletAdapterFactory;
}

/**
 * Connector for Browser Wallet extensions (Azguard, Obsidian, etc.)
 *
 * These wallets have their own PXE running in the extension.
 * We communicate via the adapter interface.
 * Initializes eagerly on construction for immediate "installed" status.
 */
export class BrowserWalletConnector implements IBrowserWalletConnector {
  readonly id: string;
  readonly label: string;
  readonly type = WalletType.BROWSER_WALLET;
  readonly adapterFactory: BrowserWalletAdapterFactory;

  private _adapter: IBrowserWalletAdapter | null = null;
  private _initPromise: Promise<void> | null = null;
  // Guards async account hydration to avoid stale updates; not related to crypto tokens
  private latestAccountChangeMarker: symbol | null = null;

  constructor(config: BrowserWalletConnectorConfig) {
    this.id = config.id;
    this.label = config.label;
    this.adapterFactory = config.adapterFactory;

    // Start initialization immediately (eager init for "installed" badge)
    void this.ensureInitialized().catch((error) => {
      // Swallow to avoid unhandled rejection; installation status will remain false
      console.warn(
        `[BrowserWalletConnector:${this.id}] initialize failed`,
        error
      );
    });
  }

  /**
   * Get or create the adapter instance.
   * Async to support dynamic imports for the adapter factory.
   */
  async getAdapter(): Promise<IBrowserWalletAdapter> {
    if (!this._adapter) {
      this._adapter = await this.adapterFactory();
    }
    return this._adapter;
  }

  /**
   * Initialize the adapter and set up event listeners.
   * Called automatically in constructor (eager init).
   */
  private async initialize(): Promise<void> {
    const adapter = await this.getAdapter();

    await adapter.initialize();
    const state = adapter.getState();

    getWalletStore().setBrowserWalletState({
      isInstalled: state.isInstalled,
      supportedChains: state.supportedChains,
    });

    // Set up event listeners
    adapter.onAccountsChanged(async (accounts) => {
      const updateMarker = Symbol('accountsChanged');
      this.latestAccountChangeMarker = updateMarker;

      const selectedAccount = accounts.length > 0 ? accounts[0] : null;
      const store = getWalletStore();

      store.setBrowserWalletState({
        caipAccounts: accounts,
        caipAccount: selectedAccount,
      });

      if (selectedAccount) {
        try {
          const accountWallet = await adapter.toAccountWallet(selectedAccount);
          if (this.latestAccountChangeMarker !== updateMarker) {
            return;
          }
          getWalletStore().setBrowserWalletState({ account: accountWallet });
        } catch {
          if (this.latestAccountChangeMarker !== updateMarker) {
            return;
          }
          getWalletStore().setBrowserWalletState({ account: null });
        }
      } else {
        getWalletStore().setBrowserWalletState({ account: null });
      }
    });

    adapter.onDisconnected(async () => {
      await getWalletStore().disconnect();
    });
  }

  /**
   * Ensure initialization is in-flight or completed.
   * Safe to call multiple times; reinitializes after destroy().
   */
  private ensureInitialized(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = this.initialize().catch((error) => {
        // Reset so a later retry can occur
        this._initPromise = null;
        throw error;
      });
    }
    return this._initPromise;
  }

  /**
   * Clean up adapter resources.
   */
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

    // Check installation from adapter if not yet connected
    const adapter = this._adapter;
    const isInstalled = isBrowserWallet
      ? state.isInstalled
      : (adapter?.getState().isInstalled ?? false);

    return {
      isInstalled,
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

  getCaipAccount(): CaipAccount | null {
    const state = getWalletStore();
    if (state.walletType === WalletType.BROWSER_WALLET) {
      return state.caipAccount as CaipAccount | null;
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
    });
  }

  async sendTransaction(
    request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    const state = getWalletStore();
    const account = state.caipAccount;
    const chain = state.supportedChains[0] ?? '';

    if (!account) {
      throw new Error('No account selected');
    }

    const operation: SendTransactionOp = {
      kind: 'send_transaction',
      account,
      chain,
      calls: request.actions.map(toContractCall),
    };

    const result = await this.executeOperation(operation);

    if (result.status !== 'ok') {
      const message =
        'error' in result && result.error ? result.error : 'Transaction failed';
      return {
        status: 'failed',
        error: message,
      };
    }

    return {
      status: 'success',
      txHash: typeof result.result === 'string' ? result.result : undefined,
      rawResult: result.result,
    };
  }

  /**
   * Execute a single operation and return the result directly.
   * Throws if no result is returned.
   */
  async executeOperation(
    operation: BrowserWalletOperation
  ): Promise<BrowserWalletOperationResult> {
    const adapter = await this.getAdapter();
    const results = await adapter.executeOperations([operation]);

    if (!results.length) {
      throw new Error('No result returned from wallet operation');
    }

    return results[0];
  }
}
