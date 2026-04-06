import type { Wallet } from '@aztec/aztec.js';
import type { PasskeyWalletConfig } from '../shared/types';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import { IframeManager } from './IframeManager';
import { PXEProxy } from './PXEProxy';

export function createPasskeyWallet(config: PasskeyWalletConfig): PasskeyWallet {
  return new PasskeyWallet(config);
}

export class PasskeyWallet {
  private iframeManager: IframeManager;
  private pxeProxy: PXEProxy | null = null;
  private wallet: Wallet | null = null;
  private _address: string | null = null;
  private _isConnecting = false;

  constructor(private config: PasskeyWalletConfig) {
    this.iframeManager = new IframeManager(config.walletHost ?? DEFAULT_WALLET_HOST);
  }

  get isConnected(): boolean { return this.wallet !== null; }
  get isConnecting(): boolean { return this._isConnecting; }

  async connect(): Promise<Wallet> {
    if (this.wallet) return this.wallet;
    this._isConnecting = true;
    try {
      const channel = await this.iframeManager.connect(this.config.contracts);
      this.pxeProxy = new PXEProxy(channel);
      const result = (await this.pxeProxy.call('connect', [])) as { address: string };
      this._address = result.address;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.wallet = this.pxeProxy.createInterface<any>() as Wallet;
      return this.wallet;
    } finally {
      this._isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pxeProxy) await this.pxeProxy.call('disconnect', []);
    this.iframeManager.disconnect();
    this.wallet = null;
    this._address = null;
    this.pxeProxy = null;
  }

  getWallet(): Wallet | null { return this.wallet; }
  getAddress(): string | null { return this._address; }
}
