/**
 * EmbeddedConnector - Connector for Embedded wallets
 *
 * Uses app-managed PXE with internal signing.
 * Keys are stored locally in the browser.
 */

import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PXE } from '@aztec/pxe/server';
import { SharedPXEService } from '../services/aztec/pxe';
import { getNetworkStore } from '../store/network';
import { getWalletStore, clearSavedAccount } from '../store/wallet';
import { WalletType } from '../types/aztec';
import type {
  EmbeddedWalletConnector,
  ConnectorStatus,
} from '../../types/walletConnector';

export const EMBEDDED_CONNECTOR_ID = 'embedded' as const;

/**
 * Connector for Embedded wallets (internal signing).
 *
 * This connector uses app-managed PXE with keys stored locally.
 * All signing happens within the app.
 *
 * Reads state directly from the Zustand store.
 */
export class EmbeddedConnector implements EmbeddedWalletConnector {
  readonly id = EMBEDDED_CONNECTOR_ID;
  readonly label = 'Embedded Wallet';
  readonly type = WalletType.EMBEDDED;

  getStatus(): ConnectorStatus {
    const state = getWalletStore();
    const isThisConnector = state.walletType === WalletType.EMBEDDED;

    return {
      isInstalled: true,
      status: isThisConnector ? state.status : 'disconnected',
      error: isThisConnector ? state.error : null,
    };
  }

  getAccount() {
    const state = getWalletStore();
    return state.walletType === WalletType.EMBEDDED ? state.account : null;
  }

  async connect(): Promise<void> {
    const state = getWalletStore();
    if (state.walletType === WalletType.EMBEDDED && state.account) {
      return;
    }
    await state.connectEmbedded();
  }

  async disconnect(): Promise<void> {
    await getWalletStore().disconnect(clearSavedAccount);
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

/**
 * Factory function to create an Embedded connector
 */
export const createEmbeddedConnector = (): EmbeddedConnector => {
  return new EmbeddedConnector();
};
