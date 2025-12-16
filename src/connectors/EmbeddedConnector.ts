/**
 * EmbeddedConnector - Connector for Embedded wallets
 *
 * Uses app-managed PXE with internal signing.
 * Keys are stored locally in the browser.
 */

import { WalletType } from '../types/aztec';
import type {
  EmbeddedWalletConnector,
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../types/walletConnector';
import type { UseEmbeddedWalletReturn } from '../providers/hooks/useEmbeddedWallet';

export const EMBEDDED_CONNECTOR_ID = 'embedded' as const;

/**
 * Connector for Embedded wallets (internal signing).
 *
 * This connector uses app-managed PXE with keys stored locally.
 * All signing happens within the app.
 */
export class EmbeddedConnector implements EmbeddedWalletConnector {
  readonly id = EMBEDDED_CONNECTOR_ID;
  readonly label = 'Embedded Wallet';
  readonly type = WalletType.EMBEDDED;

  private _embeddedState: UseEmbeddedWalletReturn | null = null;

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(state: UseEmbeddedWalletReturn) {
    this._embeddedState = state;
  }

  private getEmbeddedState(): UseEmbeddedWalletReturn {
    if (!this._embeddedState) {
      throw new Error('Embedded connector has not been initialized');
    }
    return this._embeddedState;
  }

  getStatus(): ConnectorStatus {
    const { state, error } = this.getEmbeddedState();

    return {
      isInstalled: true,
      status: state.status,
      error,
    };
  }

  getAccount() {
    return this.getEmbeddedState().state.embeddedAccount;
  }

  async connect(): Promise<void> {
    const { state, actions } = this.getEmbeddedState();
    if (state.embeddedAccount) {
      return;
    }
    await actions.create();
  }

  disconnect(): Promise<void> {
    this.getEmbeddedState().actions.disconnect();
    return Promise.resolve();
  }

  async sendTransaction(
    _request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    throw new Error('sendTransaction is not supported for the embedded connector');
  }

  getPXE() {
    return this.getEmbeddedState().services.pxe;
  }

  getWallet() {
    return this.getEmbeddedState().services.wallet;
  }

  getSponsoredFeePaymentMethod() {
    return this.getEmbeddedState().services.getSponsoredFeePaymentMethod();
  }

  createAccount() {
    return this.getEmbeddedState().actions.create();
  }

  connectTestAccount(index: number) {
    return this.getEmbeddedState().actions.connectTest(index);
  }

  connectExistingAccount() {
    return this.getEmbeddedState().actions.connectExisting();
  }

  hasSavedAccount() {
    return this.getEmbeddedState().actions.hasSavedAccount();
  }

  isDeploying() {
    return this.getEmbeddedState().state.status === 'deploying';
  }
}

/**
 * Factory function to create an Embedded connector
 */
export const createEmbeddedConnector = (): EmbeddedConnector => {
  return new EmbeddedConnector();
};
