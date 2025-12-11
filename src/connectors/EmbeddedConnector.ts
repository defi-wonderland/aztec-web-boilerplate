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

  private state: UseEmbeddedWalletReturn | null = null;

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(state: UseEmbeddedWalletReturn) {
    this.state = state;
  }

  private getState(): UseEmbeddedWalletReturn {
    if (!this.state) {
      throw new Error('Embedded connector has not been initialized');
    }
    return this.state;
  }

  getStatus(): ConnectorStatus {
    const state = this.getState();
    return {
      isInstalled: true,
      isConnected: state.state.embeddedAccount !== null,
      isConnecting: state.isLoading,
      isBusy: state.state.isDeploying,
      error: state.error,
    };
  }

  getAccount() {
    return this.getState().state.embeddedAccount;
  }

  async connect(): Promise<void> {
    const state = this.getState();
    if (state.state.embeddedAccount) {
      return;
    }
    await state.actions.create();
  }

  disconnect(): Promise<void> {
    this.getState().actions.disconnect();
    return Promise.resolve();
  }

  async sendTransaction(
    _request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    throw new Error('sendTransaction is not supported for the embedded connector');
  }

  getPXE() {
    return this.getState().services.pxe;
  }

  getWallet() {
    return this.getState().services.wallet;
  }

  getSponsoredFeePaymentMethod() {
    return this.getState().services.getSponsoredFeePaymentMethod();
  }

  createAccount() {
    return this.getState().actions.create();
  }

  connectTestAccount(index: number) {
    return this.getState().actions.connectTest(index);
  }

  connectExistingAccount() {
    return this.getState().actions.connectExisting();
  }

  isDeploying() {
    return this.getState().state.isDeploying;
  }
}

/**
 * Factory function to create an Embedded connector
 */
export const createEmbeddedConnector = (): EmbeddedConnector => {
  return new EmbeddedConnector();
};
