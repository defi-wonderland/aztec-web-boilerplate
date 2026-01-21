/**
 * ExternalSignerConnector - Connector for External Signer wallets
 *
 * Uses app-managed PXE with external signing (MetaMask, WalletConnect, etc.)
 * Self-contained: creates and manages its own signer internally.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PXE } from '@aztec/pxe/server';
import { SharedPXEService } from '../services/aztec/pxe';
import { getEVMWalletService } from '../services/evm';
import { createEVMSigner } from '../signers';
import { getNetworkStore } from '../store/network';
import { getWalletStore } from '../store/wallet';
import { WalletType, ExternalSignerType } from '../types/aztec';
import type {
  ExternalSignerWalletConnector,
  ConnectorStatus,
} from '../../types/walletConnector';
import type { ExternalSigner } from '../signers/types';

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
 *
 * Creates its own signer internally using EVMWalletService singleton.
 */
export class ExternalSignerConnector implements ExternalSignerWalletConnector {
  readonly id: string;
  readonly label: string;
  readonly type = WalletType.EXTERNAL_SIGNER;
  readonly signerType: ExternalSignerType;
  readonly rdns?: string;

  // Signer created lazily on first access
  private _signer: ExternalSigner | null = null;

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
   * Get or create the signer for this connector.
   * Creates lazily using the EVMWalletService singleton.
   */
  private getSigner(): ExternalSigner {
    if (!this._signer) {
      if (this.signerType !== ExternalSignerType.EVM_WALLET) {
        throw new Error(`Unknown signer type: ${this.signerType}`);
      }
      const evmService = getEVMWalletService();
      this._signer = createEVMSigner(evmService, this.rdns);
    }
    return this._signer;
  }

  getStatus(): ConnectorStatus {
    const state = getWalletStore();
    const isExternalSigner = state.walletType === WalletType.EXTERNAL_SIGNER;
    const isThisConnectorConnected =
      isExternalSigner && state.connectedRdns === this.rdns;

    const status =
      isExternalSigner && !isThisConnectorConnected
        ? 'disconnected'
        : isExternalSigner
          ? state.status
          : 'disconnected';

    const signer = this.getSigner();

    return {
      isInstalled: signer.isAvailable(),
      status,
      error: isThisConnectorConnected ? state.error : null,
    };
  }

  getAccount(): AccountWithSecretKey | null {
    const state = getWalletStore();
    // Only return account if this connector's rdns matches the connected one
    if (
      state.walletType === WalletType.EXTERNAL_SIGNER &&
      state.connectedRdns === this.rdns
    ) {
      return state.account;
    }
    return null;
  }

  async connect(): Promise<void> {
    const signer = this.getSigner();
    await getWalletStore().connectExternalSigner(signer, this.id);
  }

  async disconnect(): Promise<void> {
    const signer = this._signer;
    await getWalletStore().disconnect(() => {
      if (signer) {
        signer.disconnect();
      }
      this._signer = null;
    });
  }

  getPXE(): PXE | null {
    const config = getNetworkStore().currentConfig;
    const instance = SharedPXEService.getExistingInstance(
      config.nodeUrl,
      config.name
    );
    return instance?.pxe ?? null;
  }

  getWallet(): Wallet | null {
    const config = getNetworkStore().currentConfig;
    const instance = SharedPXEService.getExistingInstance(
      config.nodeUrl,
      config.name
    );
    return instance?.wallet ?? null;
  }

  async getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    const config = getNetworkStore().currentConfig;
    const instance = SharedPXEService.getExistingInstance(
      config.nodeUrl,
      config.name
    );
    if (!instance) {
      throw new Error('PXE not initialized');
    }
    return instance.getSponsoredFeePaymentMethod();
  }
}
