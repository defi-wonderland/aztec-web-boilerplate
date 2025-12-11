/**
 * BrowserWalletConnector - Connector for Browser Wallet extensions
 *
 * Uses external PXE (browser extension manages everything).
 * Currently supports Azguard wallet.
 */

import type { SendTransactionOperation } from '@azguardwallet/types';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../types/aztec';
import type {
  BrowserWalletConnector as IBrowserWalletConnector,
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../types/walletConnector';
import type { UseBrowserWalletReturn } from '../providers/hooks/useBrowserWallet';

export const BROWSER_WALLET_CONNECTOR_ID = 'browser-wallet' as const;
export const AZGUARD_CONNECTOR_ID = 'azguard' as const;

const toSendTransactionAction = (
  action: ConnectorTransactionRequest['actions'][number]
): SendTransactionOperation['actions'][number] => ({
  kind: 'call',
  contract: action.contract,
  method: action.method,
  args: action.args.map((arg) =>
    typeof arg === 'bigint' ? arg.toString() : String(arg)
  ),
});

interface BrowserWalletConnectorConfig {
  id?: string;
  label?: string;
}

/**
 * Connector for Browser Wallet extensions (Azguard, etc.)
 *
 * These wallets have their own PXE running in the extension.
 * We communicate via CAIP protocol.
 */
export class BrowserWalletConnector implements IBrowserWalletConnector {
  readonly id: string;
  readonly label: string;
  readonly type = WalletType.BROWSER_WALLET;

  private state: UseBrowserWalletReturn | null = null;

  constructor(config?: BrowserWalletConnectorConfig) {
    this.id = config?.id ?? AZGUARD_CONNECTOR_ID;
    this.label = config?.label ?? 'Azguard Wallet';
  }

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(state: UseBrowserWalletReturn) {
    this.state = state;
  }

  private getState(): UseBrowserWalletReturn {
    if (!this.state) {
      throw new Error('Browser wallet connector has not been initialized');
    }
    return this.state;
  }

  getStatus(): ConnectorStatus {
    const state = this.getState();
    return {
      isInstalled: state.state.isInstalled,
      isConnected: state.state.isConnected,
      isConnecting: state.state.isConnecting,
      isBusy: state.state.isConnecting,
      error: state.state.error,
    };
  }

  getAccount(): AccountWithSecretKey | null {
    return this.getState().accountWallet;
  }

  getCaipAccount() {
    return this.getState().state.selectedAccount;
  }

  connect(): Promise<void> {
    return this.getState().actions.connect();
  }

  disconnect(): Promise<void> {
    return this.getState().actions.disconnect();
  }

  async sendTransaction(
    request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    const state = this.getState();
    const account = state.state.selectedAccount;

    if (!account) {
      throw new Error('No account selected');
    }

    const operation: SendTransactionOperation = {
      kind: 'send_transaction',
      account,
      actions: request.actions.map(toSendTransactionAction),
    };

    const [result] = await state.actions.executeOperations([operation]);

    if (result.status !== 'ok') {
      const message = 'error' in result ? result.error : 'Transaction failed';
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

  executeOperations(
    operations: Parameters<UseBrowserWalletReturn['actions']['executeOperations']>[0]
  ) {
    return this.getState().actions.executeOperations(operations);
  }

  switchAccount(
    account: Parameters<UseBrowserWalletReturn['actions']['switchAccount']>[0]
  ) {
    return this.getState().actions.switchAccount(account);
  }

  getClient() {
    return this.getState().client;
  }

  getAccounts() {
    return this.getState().state.accounts;
  }
}

/**
 * Factory function to create an Azguard connector
 */
export const createAzguardConnector = (): BrowserWalletConnector => {
  return new BrowserWalletConnector({
    id: AZGUARD_CONNECTOR_ID,
    label: 'Azguard Wallet',
  });
};
