import type { Wallet } from '@aztec/aztec.js';
import type { PasskeyWalletConfig, PopupResponse } from '../shared/types';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import { IframeManager } from './IframeManager';
import { PXEProxy } from './PXEProxy';
import { PopupManager } from './PopupManager';

export function createPasskeyWallet(config: PasskeyWalletConfig): PasskeyWallet {
  return new PasskeyWallet(config);
}

export class PasskeyWallet {
  private iframeManager: IframeManager;
  private popupManager: PopupManager;
  private pxeProxy: PXEProxy | null = null;
  private wallet: Wallet | null = null;
  private _address: string | null = null;
  private _isConnecting = false;

  constructor(private config: PasskeyWalletConfig) {
    const host = config.walletHost ?? DEFAULT_WALLET_HOST;
    this.iframeManager = new IframeManager(host);
    this.popupManager = new PopupManager(host);
  }

  get isConnected(): boolean { return this.wallet !== null; }
  get isConnecting(): boolean { return this._isConnecting; }

  /**
   * Connect flow:
   * 1. Open popup for passkey ceremony (must happen in user gesture context)
   * 2. Popup returns derived keys
   * 3. Create iframe + encrypted channel
   * 4. Send keys to host via channel
   * 5. Host initializes PXE, registers account
   * 6. Returns Wallet
   */
  async connect(): Promise<Wallet> {
    if (this.wallet) return this.wallet;
    this._isConnecting = true;

    try {
      // Step 1: Open popup FIRST (we're in user gesture context from button click)
      const popupResponse = await this.popupManager.openPopup('connect');

      if (popupResponse.type !== 'auth-keys') {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 2: Create iframe and encrypted channel
      const channel = await this.iframeManager.connect(this.config.contracts);
      this.pxeProxy = new PXEProxy(channel);

      // Step 3: Send the keys to the host to initialize PXE
      const result = (await this.pxeProxy.call('initWithKeys', [popupResponse])) as { address: string };
      this._address = result.address;

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
