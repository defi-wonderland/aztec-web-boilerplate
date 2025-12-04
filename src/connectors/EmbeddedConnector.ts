import type { UseEmbeddedWalletInternalReturn } from '../providers/hooks';
import { WalletType } from '../types/aztec';
import type {
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
  WalletConnector,
} from '../types/walletConnector';

export class EmbeddedConnector implements WalletConnector {
  readonly id = 'embedded';
  readonly label = 'Embedded Wallet';
  readonly type = WalletType.EMBEDDED;
  readonly capabilities = {
    hasPXE: true,
    hasSponsoredFees: true,
    canExecuteOperations: false,
    canSwitchAccounts: false,
  } as const;

  private resolver: (() => UseEmbeddedWalletInternalReturn) | null = null;

  constructor(resolver?: () => UseEmbeddedWalletInternalReturn) {
    if (resolver) {
      this.resolver = resolver;
    }
  }

  setResolver(resolver: () => UseEmbeddedWalletInternalReturn) {
    this.resolver = resolver;
  }

  private resolve(): UseEmbeddedWalletInternalReturn {
    if (!this.resolver) {
      throw new Error('Embedded connector has not been bound to provider state');
    }
    return this.resolver();
  }

  getStatus(): ConnectorStatus {
    const embedded = this.resolve();
    return {
      isInstalled: true,
      isConnected: embedded.state.embeddedAccount !== null,
      isConnecting: embedded.isLoading,
      isBusy: embedded.state.isDeploying,
      error: embedded.error,
    };
  }

  getAccount() {
    return this.resolve().state.embeddedAccount;
  }

  async connect(): Promise<void> {
    const embedded = this.resolve();
    if (embedded.state.embeddedAccount) {
      return;
    }
    await embedded.actions.create();
  }

  disconnect(): Promise<void> {
    this.resolve().actions.disconnect();
    return Promise.resolve();
  }

  async sendTransaction(
    _request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    throw new Error('sendTransaction is not supported for the embedded connector');
  }

  getPXE() {
    return this.resolve().services.pxe;
  }

  getWallet() {
    return this.resolve().services.wallet;
  }

  getSponsoredFeePaymentMethod() {
    return this.resolve().services.getSponsoredFeePaymentMethod();
  }

  createAccount() {
    return this.resolve().actions.create();
  }

  connectTestAccount(index: number) {
    return this.resolve().actions.connectTest(index);
  }

  connectExistingAccount() {
    return this.resolve().actions.connectExisting();
  }

  isDeploying() {
    return this.resolve().state.isDeploying;
  }
}

