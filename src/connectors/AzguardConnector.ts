import type { SendTransactionOperation } from '@azguardwallet/types';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { UseAzguardWalletInternalReturn } from '../providers/hooks';
import { WalletType } from '../types/aztec';
import type {
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
  WalletConnector,
} from '../types/walletConnector';

/**
 * @deprecated Use `BrowserWalletConnector` instead.
 */
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

/**
 * @deprecated Use `BrowserWalletConnector` instead.
 */
export class AzguardConnector implements WalletConnector {
  readonly id = AZGUARD_CONNECTOR_ID;
  readonly label = 'Azguard Wallet';
  readonly type = WalletType.BROWSER_WALLET;

  private azguardState: UseAzguardWalletInternalReturn | null = null;

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(state: UseAzguardWalletInternalReturn) {
    this.azguardState = state;
  }

  private get azguard(): UseAzguardWalletInternalReturn {
    if (!this.azguardState) {
      throw new Error('Azguard connector has not been initialized');
    }
    return this.azguardState;
  }

  getStatus(): ConnectorStatus {
    return {
      isInstalled: this.azguard.state.isInstalled,
      isConnected: this.azguard.state.isConnected,
      isConnecting: this.azguard.state.isConnecting,
      isBusy: this.azguard.state.isConnecting,
      error: this.azguard.state.error,
    };
  }

  getAccount(): AccountWithSecretKey | null {
    return this.azguard.accountWallet;
  }

  getCaipAccount() {
    return this.azguard.state.selectedAccount;
  }

  connect(): Promise<void> {
    return this.azguard.actions.connect();
  }

  disconnect(): Promise<void> {
    return this.azguard.actions.disconnect();
  }

  async sendTransaction(
    request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    const account = this.azguard.state.selectedAccount;
    if (!account) {
      throw new Error('No Azguard account selected');
    }

    const operation: SendTransactionOperation = {
      kind: 'send_transaction',
      account,
      actions: request.actions.map(toSendTransactionAction),
    };

    const [result] = await this.azguard.actions.executeOperations([operation]);

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
    operations: Parameters<
      UseAzguardWalletInternalReturn['actions']['executeOperations']
    >[0]
  ) {
    return this.azguard.actions.executeOperations(operations);
  }

  switchAccount(
    account: Parameters<
      UseAzguardWalletInternalReturn['actions']['switchAccount']
    >[0]
  ) {
    return this.azguard.actions.switchAccount(account);
  }

  getClient() {
    return this.azguard.client;
  }

  getAccounts() {
    return this.azguard.state.accounts;
  }
}
