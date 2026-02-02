import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { PXE } from '@aztec/pxe/server';
import { WalletType, ExternalSignerType } from './aztec';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
  ConnectorTransactionRequest,
  ConnectorTransactionResult,
} from './browserWallet';
import type { CaipAccount } from '@azguardwallet/types';

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

export type { ConnectorTransactionRequest, ConnectorTransactionResult };

export interface WalletConnector {
  readonly id: WalletConnectorId;
  readonly label: string;
  readonly type: WalletType;

  getStatus(): ConnectorStatus;
  getAccount(): AccountWithSecretKey | null;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface EmbeddedWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.EMBEDDED;

  getPXE: () => PXE | null;
  getWallet: () => Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface ExternalSignerWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.EXTERNAL_SIGNER;
  readonly signerType: ExternalSignerType;
  /** RDNS identifier for the EVM wallet (e.g., 'io.metamask') */
  readonly rdns?: string;

  getPXE: () => PXE | null;
  getWallet: () => Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface BrowserWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.BROWSER_WALLET;

  getCaipAccount: () => CaipAccount | null;
  sendTransaction: (
    request: ConnectorTransactionRequest
  ) => Promise<ConnectorTransactionResult>;
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
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
