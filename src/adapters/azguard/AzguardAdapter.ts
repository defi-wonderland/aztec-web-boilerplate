/**
 * AzguardAdapter - Browser wallet adapter for Azguard wallet.
 *
 * Implements IBrowserWalletAdapter to provide Azguard-specific
 * connection logic while keeping the hook wallet-agnostic.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type {
  CaipAccount,
  CaipChain,
  SimulateViewsOperation,
  SendTransactionOperation,
  AztecGetTxReceiptOperation,
  RegisterContractOperation,
  Operation,
} from '@azguardwallet/types';
import type {
  IBrowserWalletAdapter,
  BrowserWalletState,
  BrowserWalletOperationResult,
  BrowserWalletOperation,
} from '../../types/browserWallet';
import { AzguardWalletService } from './AzguardWalletService';
import { getChainId, type AztecChainId } from '../../config/networks/constants';
import { parseAddressFromCaip } from '../../utils/azguard';

const AZGUARD_METHODS = [
  'register_contract',
  'send_transaction',
  'simulate_views',
  'simulate_utility',
  'add_private_authwit',
  'call',
  'aztec_getTxReceipt',
];

const buildDappMetadata = () => ({
  name: 'Aztec Web Boilerplate',
  description: 'Privacy-first application built on Aztec Network',
  url: typeof window !== 'undefined' ? window.location.origin : '',
  icon: typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : '',
});

export class AzguardAdapter implements IBrowserWalletAdapter {
  readonly id = 'azguard';
  readonly label = 'Azguard Wallet';

  private service: AzguardWalletService;

  constructor() {
    this.service = new AzguardWalletService();
  }

  async initialize(): Promise<void> {
    await this.service.initialize();
  }

  destroy(): void {
    this.service.destroy();
  }

  getState(): BrowserWalletState {
    return this.service.getState();
  }

  async connect(networkName: string): Promise<string[]> {
    const chain: AztecChainId = getChainId(networkName);
    const dappMetadata = buildDappMetadata();
    const requiredPermissions = [{ chains: [chain], methods: AZGUARD_METHODS }];

    return this.service.connect(dappMetadata, requiredPermissions);
  }

  async disconnect(): Promise<void> {
    return this.service.disconnect();
  }

  async executeOperations(ops: BrowserWalletOperation[]): Promise<BrowserWalletOperationResult[]> {
    const azguardOps = ops.map((op) => this.toAzguardOperation(op));
    return this.service.executeOperations(azguardOps);
  }

  /**
   * Translate generic operations to Azguard-specific format.
   * This is where all wallet-specific type casting happens.
   */
  private toAzguardOperation(op: BrowserWalletOperation): Operation {
    switch (op.kind) {
      case 'simulate_views': {
        const azguardOp: SimulateViewsOperation = {
          kind: 'simulate_views',
          account: op.account as CaipAccount,
          calls: op.calls.map((call) => ({
            kind: 'call' as const,
            contract: call.contract,
            method: call.method,
            args: call.args.map((arg) =>
              typeof arg === 'bigint' ? arg.toString() : String(arg)
            ),
          })),
        };
        return azguardOp;
      }
      case 'send_transaction': {
        const azguardOp: SendTransactionOperation = {
          kind: 'send_transaction',
          account: op.account as CaipAccount,
          actions: op.calls.map((call) => ({
            kind: 'call' as const,
            contract: call.contract,
            method: call.method,
            args: call.args.map((arg) =>
              typeof arg === 'bigint' ? arg.toString() : arg
            ),
          })),
        };
        return azguardOp;
      }
      case 'aztec_getTxReceipt': {
        const azguardOp: AztecGetTxReceiptOperation = {
          kind: 'aztec_getTxReceipt',
          chain: op.chain as CaipChain,
          txHash: op.txHash,
        };
        return azguardOp;
      }
      case 'register_contract': {
        const azguardOp: RegisterContractOperation = {
          kind: 'register_contract',
          chain: op.chain as CaipChain,
          address: op.address,
          instance: op.instance,
          artifact: op.artifact,
        };
        return azguardOp;
      }
    }
  }

  async toAccountWallet(accountId: string): Promise<AccountWithSecretKey> {
    const address = parseAddressFromCaip(accountId);
    return { getAddress: () => address } as unknown as AccountWithSecretKey;
  }

  onAccountsChanged(cb: (accounts: string[]) => void): void {
    this.service.onAccountsChanged(cb);
  }

  onDisconnected(cb: () => void): void {
    this.service.onDisconnected(cb);
  }
}

export const createAzguardAdapter = (): IBrowserWalletAdapter => new AzguardAdapter();
