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

const toSendTransactionAction = (
  action: ConnectorTransactionRequest['actions'][number]
): SendTransactionOperation['actions'][number] => ({
  kind: 'call',
  contract: action.contract,
  method: action.method,
  args: action.args.map((arg) => (typeof arg === 'bigint' ? arg.toString() : String(arg))),
});

export class AzguardConnector implements WalletConnector {
  readonly id = 'azguard';
  readonly label = 'Azguard Wallet';
  readonly type = WalletType.AZGUARD;
  readonly capabilities = {
    hasPXE: false,
    hasSponsoredFees: false,
    canExecuteOperations: true,
    canSwitchAccounts: true,
  } as const;

  private azguardResolver: (() => UseAzguardWalletInternalReturn) | null = null;
  private accountWalletResolver: (() => AccountWithSecretKey | null) | null = null;

  constructor(
    getAzguard?: () => UseAzguardWalletInternalReturn,
    getAccountWallet?: () => AccountWithSecretKey | null
  ) {
    if (getAzguard) {
      this.azguardResolver = getAzguard;
    }
    if (getAccountWallet) {
      this.accountWalletResolver = getAccountWallet;
    }
  }

  setResolvers(params: {
    getAzguard: () => UseAzguardWalletInternalReturn;
    getAccountWallet: () => AccountWithSecretKey | null;
  }) {
    this.azguardResolver = params.getAzguard;
    this.accountWalletResolver = params.getAccountWallet;
  }

  private get azguard(): UseAzguardWalletInternalReturn {
    if (!this.azguardResolver) {
      throw new Error('Azguard connector has not been bound to provider state');
    }
    return this.azguardResolver();
  }

  private getAccountWallet(): AccountWithSecretKey | null {
    if (!this.accountWalletResolver) {
      throw new Error('Azguard connector missing account wallet resolver');
    }
    return this.accountWalletResolver();
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
    return this.getAccountWallet();
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

  async sendTransaction(request: ConnectorTransactionRequest): Promise<ConnectorTransactionResult> {
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

  executeOperations(operations: Parameters<UseAzguardWalletInternalReturn['actions']['executeOperations']>[0]) {
    return this.azguard.actions.executeOperations(operations);
  }

  switchAccount(account: Parameters<UseAzguardWalletInternalReturn['actions']['switchAccount']>[0]) {
    return this.azguard.actions.switchAccount(account);
  }

  getClient() {
    return this.azguard.client;
  }

  getAccounts() {
    return this.azguard.state.accounts;
  }
}

