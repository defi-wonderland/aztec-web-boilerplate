/**
 * ExternalSignerConnector - Connector for External Signer wallets
 *
 * Uses app-managed PXE with external signing (MetaMask, WalletConnect, etc.)
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PXE } from '@aztec/pxe/server';
import { WalletType, ExternalSignerType } from '../types/aztec';
import type { UseExternalSignerWalletReturn } from '../providers/hooks/useExternalSignerWallet';
import type { ExternalSigner } from '../signers/types';
import type {
  ExternalSignerWalletConnector,
  ConnectorStatus,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from '../types/walletConnector';

export const EXTERNAL_SIGNER_CONNECTOR_ID = 'external-signer' as const;

interface ExternalSignerConnectorConfig {
  id?: string;
  label?: string;
  signerType: ExternalSignerType;
  rdns?: string;
}

/**
 * Connector for External Signer wallets (MetaMask, WalletConnect, etc.)
 *
 * This connector uses app-managed PXE with external signing.
 * The external wallet only signs transactions - all Aztec logic runs in the app.
 */
export class ExternalSignerConnector implements ExternalSignerWalletConnector {
  readonly id: string;
  readonly label: string;
  readonly type = WalletType.EXTERNAL_SIGNER;
  readonly signerType: ExternalSignerType;
  readonly rdns?: string;

  private _signerState: UseExternalSignerWalletReturn | null = null;
  private signer: ExternalSigner | null = null;

  constructor(config: ExternalSignerConnectorConfig) {
    this.signerType = config.signerType;
    this.id = config.id ?? `external-${config.signerType}`;
    this.label = config.label ?? this.getDefaultLabel(config.signerType);
    this.rdns = config.rdns;
  }

  private getDefaultLabel(signerType: ExternalSignerType): string {
    switch (signerType) {
      case ExternalSignerType.EVM_WALLET:
        return 'EVM Wallet';
      default:
        return 'External Wallet';
    }
  }

  /**
   * Update connector with latest hook state. Called by provider each render.
   */
  updateState(
    state: UseExternalSignerWalletReturn,
    signer: ExternalSigner | null
  ) {
    this._signerState = state;
    this.signer = signer;
  }

  private getSignerState(): UseExternalSignerWalletReturn {
    if (!this._signerState) {
      throw new Error('External Signer connector has not been initialized');
    }
    return this._signerState;
  }

  getStatus(): ConnectorStatus {
    const { state, error } = this.getSignerState();

    const isThisConnectorConnected =
      state.status === 'connected' && state.connectedRdns === this.rdns;

    const status =
      state.status === 'connected' && !isThisConnectorConnected
        ? 'disconnected'
        : state.status;

    return {
      isInstalled: this.signer?.isAvailable() ?? false,
      status,
      error: isThisConnectorConnected ? error : null,
    };
  }

  getAccount(): AccountWithSecretKey | null {
    const { state } = this.getSignerState();
    // Only return account if this connector's rdns matches the connected one
    return state.connectedRdns === this.rdns ? state.aztecAccount : null;
  }

  async connect(): Promise<void> {
    if (!this.signer) {
      throw new Error('No signer configured for this connector');
    }
    await this.getSignerState().actions.connect(this.signer);
  }

  async disconnect(): Promise<void> {
    this.getSignerState().actions.disconnect();
  }

  async sendTransaction(
    _request: ConnectorTransactionRequest
  ): Promise<ConnectorTransactionResult> {
    throw new Error(
      'sendTransaction is not directly supported - use Aztec SDK with the account'
    );
  }

  getPXE(): PXE | null {
    return this.getSignerState().services.pxe;
  }

  getWallet(): Wallet | null {
    return this.getSignerState().services.wallet;
  }

  getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    return this.getSignerState().services.getSponsoredFeePaymentMethod();
  }

  isDeploying(): boolean {
    return this.getSignerState().state.status === 'deploying';
  }

  getEVMAddress(): string | null {
    return this.signer?.getEVMAddress() ?? null;
  }

  getSigner(): ExternalSigner | null {
    return this.signer;
  }
}
