/**
 * BrowserWalletConnector - Connector for Browser Wallet extensions
 *
 * Uses external PXE (browser extension manages everything).
 * Supports any wallet that implements IBrowserWalletAdapter.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../types/aztec';
import type {
  BrowserWalletConnector as IBrowserWalletConnector,
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../types/walletConnector';
import type { UseBrowserWalletReturn } from '../providers/hooks/useBrowserWallet';
import type {
  IBrowserWalletAdapter,
  BrowserWalletAdapterFactory,
  BrowserWalletOperation,
  SendTransactionOp,
  ContractCall,
} from '../types/browserWallet';

export const BROWSER_WALLET_CONNECTOR_ID = 'browser-wallet' as const;

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
 */
export class BrowserWalletConnector implements IBrowserWalletConnector {
  readonly id: string;
  readonly label: string;
  readonly type = WalletType.BROWSER_WALLET;
  readonly adapterFactory: BrowserWalletAdapterFactory;

  private _browserState: UseBrowserWalletReturn | null = null;
  private _adapter: IBrowserWalletAdapter | null = null;

  constructor(config: BrowserWalletConnectorConfig) {
    this.id = config.id;
    this.label = config.label;
    this.adapterFactory = config.adapterFactory;
  }

  /**
   * Get or create the adapter instance.
   */
  getAdapter(): IBrowserWalletAdapter {
    if (!this._adapter) {
      this._adapter = this.adapterFactory();
    }
    return this._adapter;
  }

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(state: UseBrowserWalletReturn) {
    this._browserState = state;
  }

  private getBrowserState(): UseBrowserWalletReturn {
    if (!this._browserState) {
      throw new Error('Browser wallet connector has not been initialized');
    }
    return this._browserState;
  }

  getStatus(): ConnectorStatus {
    const { state } = this.getBrowserState();

    return {
      isInstalled: state.isInstalled,
      status: state.status,
      error: state.error,
    };
  }

  getAccount(): AccountWithSecretKey | null {
    return this.getBrowserState().accountWallet;
  }

  getCaipAccount() {
    return this.getBrowserState().state.selectedAccount;
  }

  connect(): Promise<void> {
    return this.getBrowserState().actions.connect();
  }

  disconnect(): Promise<void> {
    return this.getBrowserState().actions.disconnect();
  }

  async sendTransaction(
    request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    const { state, actions } = this.getBrowserState();
    const account = state.selectedAccount;
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

    const [result] = await actions.executeOperations([operation]);

    if (result.status !== 'ok') {
      const message = 'error' in result && result.error ? result.error : 'Transaction failed';
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

  executeOperations(operations: BrowserWalletOperation[]) {
    return this.getBrowserState().actions.executeOperations(operations);
  }
}
