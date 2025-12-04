import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import type { AzguardClient } from '@azguardwallet/client';
import type { CaipAccount, Operation, OperationResult } from '@azguardwallet/types';
import type { WalletType } from './aztec';

export type WalletConnectorId = 'embedded' | 'azguard' | string;

export interface ConnectorCapabilities {
  hasPXE: boolean;
  hasSponsoredFees: boolean;
  canExecuteOperations: boolean;
  canSwitchAccounts: boolean;
}

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
  readonly capabilities: ConnectorCapabilities;

  getStatus(): ConnectorStatus;
  getAccount(): AccountWithSecretKey | null;
  getCaipAccount?(): CaipAccount | null;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  sendTransaction(request: ConnectorTransactionRequest): Promise<ConnectorTransactionResult>;

  /**
   * Optional helpers exposed by specific connectors.
   * Consumers should guard usage with capability checks.
   */
  getPXE?(): PXE | null;
  getWallet?(): Wallet | null;
  getSponsoredFeePaymentMethod?(): Promise<SponsoredFeePaymentMethod>;
  executeOperations?(operations: Operation[]): Promise<OperationResult[]>;
  switchAccount?(account: CaipAccount): Promise<void>;
  getClient?(): AzguardClient | null;
  getAccounts?(): CaipAccount[];
}

