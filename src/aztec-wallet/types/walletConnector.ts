import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PXE } from '@aztec/pxe/server';
import { WalletType, ExternalSignerType } from './aztec';

export type WalletConnectorId = string;

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'deploying'
  | 'connected';

export interface ConnectorStatus {
  isInstalled: boolean;
  status: ConnectionStatus;
  error: string | null;
}

export interface WalletConnector {
  readonly id: WalletConnectorId;
  readonly label: string;
  readonly type: WalletType;

  getStatus(): ConnectorStatus;
  /**
   * Returns the active account with secret key. Only available for connectors
   * that own the signing key (Embedded, ExternalSigner). Browser wallet
   * connectors return null because the secret key lives in the extension —
   * use getAddress() to get the active address instead.
   */
  getAccount(): AccountWithSecretKey | null;
  /**
   * Returns the active account address. Available for all connector types.
   * Returns null when the connector is not connected.
   */
  getAddress(): AztecAddress | null;
  getWallet(): Wallet | null;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface EmbeddedWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.EMBEDDED;

  getPXE: () => PXE | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface ExternalSignerWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.EXTERNAL_SIGNER;
  readonly signerType: ExternalSignerType;
  /** RDNS identifier for the EVM wallet (e.g., 'io.metamask') */
  readonly rdns?: string;

  getPXE: () => PXE | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface BrowserWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.BROWSER_WALLET;
}

export const isEmbeddedConnector = (
  connector: WalletConnector | null | undefined
): connector is EmbeddedWalletConnector => {
  return connector?.type === WalletType.EMBEDDED;
};

export const isExternalSignerConnector = (
  connector: WalletConnector | null | undefined
): connector is ExternalSignerWalletConnector => {
  return connector?.type === WalletType.EXTERNAL_SIGNER;
};

export const isBrowserWalletConnector = (
  connector: WalletConnector | null | undefined
): connector is BrowserWalletConnector => {
  return connector?.type === WalletType.BROWSER_WALLET;
};

export const hasAppManagedPXE = (
  connector: WalletConnector | null | undefined
): connector is EmbeddedWalletConnector | ExternalSignerWalletConnector => {
  return (
    connector?.type === WalletType.EMBEDDED ||
    connector?.type === WalletType.EXTERNAL_SIGNER
  );
};
