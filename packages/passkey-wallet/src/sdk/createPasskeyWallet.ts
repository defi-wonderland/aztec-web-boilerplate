import type { Wallet } from '@aztec/aztec.js';
import type { PasskeyWalletConfig, PopupResponse } from '../shared/types';
import { DEFAULT_WALLET_HOST, NETWORK_URLS } from '../shared/constants';
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

  private nodeUrl: string;

  constructor(private config: PasskeyWalletConfig) {
    const host = config.walletHost ?? DEFAULT_WALLET_HOST;
    this.nodeUrl = config.nodeUrl ?? NETWORK_URLS[config.network] ?? NETWORK_URLS.devnet;
    this.iframeManager = new IframeManager(host);
    this.popupManager = new PopupManager(host, config.rpId);
  }

  get isConnected(): boolean { return this.wallet !== null; }
  get isConnecting(): boolean { return this._isConnecting; }

  /**
   * Connect flow:
   * 1. Create iframe + encrypted channel FIRST (needs crossOriginIsolated for WASM)
   * 2. Tell iframe to listen for popup result via BroadcastChannel
   * 3. Open popup (user gesture) — popup does passkey ceremony
   * 4. Popup sends keys to iframe via BroadcastChannel (same origin)
   * 5. Iframe receives keys, SDK gets them via SecureChannel
   * 6. SDK sends initWithKeys to iframe
   * 7. Iframe initializes PXE, registers account, returns address
   */
  async connect(): Promise<Wallet> {
    if (this.wallet) return this.wallet;
    this._isConnecting = true;

    try {
      // Step 1: Open popup FIRST — must be synchronous within user gesture.
      // Any await before window.open() causes browsers to block the popup.
      this.popupManager.openPopup('connect');

      // Step 2: Create iframe and encrypted channel (async, runs while popup loads)
      const channel = await this.iframeManager.connect(this.config.contracts, this.nodeUrl);
      this.pxeProxy = new PXEProxy(channel);

      // Step 3: Tell iframe to wait for popup result via BroadcastChannel
      const popupResultPromise = this.pxeProxy.call('waitForPopup', []) as Promise<PopupResponse>;

      // Step 4-5: Wait for popup result (relayed via iframe's BroadcastChannel)
      const popupResponse = await popupResultPromise;

      if (popupResponse.type !== 'auth-keys') {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 6-7: Send keys to iframe to initialize PXE
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
