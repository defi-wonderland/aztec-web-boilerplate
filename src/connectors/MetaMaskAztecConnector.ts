import { WalletType } from '../types/aztec';
import type {
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
  WalletConnector,
} from '../types/walletConnector';
import type { UseMetaMaskAztecWalletInternalReturn } from '../providers/hooks/useMetaMaskAztecWalletInternal';

/**
 * WalletConnector implementation for MetaMask-backed Aztec accounts.
 *
 * This connector uses MetaMask as an external signer for Aztec transactions.
 * The user's private key never leaves MetaMask - each transaction requires
 * explicit MetaMask approval via personal_sign.
 */
export class MetaMaskAztecConnector implements WalletConnector {
  readonly id = 'metamask-aztec';
  readonly label = 'MetaMask (Aztec)';
  readonly type = WalletType.METAMASK;
  readonly capabilities = {
    hasPXE: true,
    hasSponsoredFees: true,
    canExecuteOperations: false,
    canSwitchAccounts: false,
  } as const;

  private state: UseMetaMaskAztecWalletInternalReturn | null = null;

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(state: UseMetaMaskAztecWalletInternalReturn) {
    this.state = state;
  }

  private getState(): UseMetaMaskAztecWalletInternalReturn {
    if (!this.state) {
      throw new Error('MetaMask Aztec connector has not been initialized');
    }
    return this.state;
  }

  getStatus(): ConnectorStatus {
    const state = this.getState();
    return {
      isInstalled: typeof window !== 'undefined' && !!window.ethereum,
      isConnected: state.state.aztecAccount !== null,
      isConnecting: state.state.isConnecting,
      isBusy: state.state.isDeploying,
      error: state.error,
    };
  }

  getAccount() {
    return this.getState().state.aztecAccount;
  }

  async connect(): Promise<void> {
    await this.getState().actions.connectAztec();
  }

  async disconnect(): Promise<void> {
    this.getState().actions.disconnect();
  }

  async sendTransaction(
    _request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    throw new Error(
      'sendTransaction is not directly supported - use Aztec SDK with the account'
    );
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

  isDeploying() {
    return this.getState().state.isDeploying;
  }

  /**
   * Get the connected EVM address (from MetaMask)
   */
  getEVMAddress() {
    return this.getState().state.evmAddress;
  }

  /**
   * Check if EVM wallet is connected (via wagmi)
   */
  isEVMConnected() {
    return this.getState().state.isEVMConnected;
  }
}
