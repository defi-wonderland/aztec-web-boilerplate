import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import type { AzguardClient } from '@azguardwallet/client';
import type { CaipAccount, Operation, OperationResult } from '@azguardwallet/types';
import { WalletType, ExternalSignerType } from './aztec';
import type { ExternalSigner } from '../signers/types';

export type WalletConnectorId = string;

export interface ConnectorStatus {
  isInstalled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isBusy: boolean;
  error: string | null;
}

export interface ConnectorTransactionAction {
  contract: string;
  method: string;
  args: unknown[];
}

export interface ConnectorTransactionRequest {
  actions: ConnectorTransactionAction[];
  metadata?: Record<string, unknown>;
}

export interface ConnectorTransactionResult {
  status: 'success' | 'failed';
  txHash?: string;
  error?: string;
  rawResult?: unknown;
}

export interface WalletConnector {
  readonly id: WalletConnectorId;
  readonly label: string;
  readonly type: WalletType;

  getStatus(): ConnectorStatus;
  getAccount(): AccountWithSecretKey | null;
  getCaipAccount?(): CaipAccount | null;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  sendTransaction(request: ConnectorTransactionRequest): Promise<ConnectorTransactionResult>;
}

export interface EmbeddedWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.EMBEDDED;

  getPXE: () => PXE | null;
  getWallet: () => Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
  createAccount: () => Promise<AccountWithSecretKey>;
  connectTestAccount: (index: number) => Promise<AccountWithSecretKey>;
  connectExistingAccount: () => Promise<AccountWithSecretKey | null>;
  isDeploying: () => boolean;
}

export interface ExternalSignerConnectorCapabilities {
  signerType: ExternalSignerType;
  hasPXE: true;
  hasSponsoredFees: boolean;
}

export interface ExternalSignerWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.EXTERNAL_SIGNER;
  readonly signerType: ExternalSignerType;

  getPXE: () => PXE | null;
  getWallet: () => Wallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
  isDeploying: () => boolean;
  getEVMAddress: () => string | null;
  getSigner: () => ExternalSigner | null;
}

export interface BrowserWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.BROWSER_WALLET;

  getCaipAccount: () => CaipAccount | null;
  executeOperations: (operations: Operation[]) => Promise<OperationResult[]>;
  switchAccount: (account: CaipAccount) => Promise<void>;
  getClient: () => AzguardClient | null;
  getAccounts: () => CaipAccount[];
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
