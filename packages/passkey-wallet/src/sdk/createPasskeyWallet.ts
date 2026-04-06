import type { Wallet } from '@aztec/aztec.js';
import type { PasskeyWalletConfig, PopupResponse } from '../shared/types';
import { DEFAULT_WALLET_HOST, NETWORK_URLS } from '../shared/constants';
import { IframeManager } from './IframeManager';
import { PXEProxy } from './PXEProxy';
import { PopupManager } from './PopupManager';

const BROADCAST_CHANNEL_NAME = 'aztec-wallet-popup';

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
   * 1. Start BroadcastChannel listener (before anything async)
   * 2. Open popup (must be synchronous — user gesture context)
   * 3. Create iframe + encrypted channel (async, runs while popup is open)
   * 4. Popup sends result via BroadcastChannel → SDK receives it
   * 5. SDK sends initWithKeys to iframe via encrypted channel
   * 6. Iframe initializes PXE, registers account, returns address
   */
  async connect(): Promise<Wallet> {
    if (this.wallet) return this.wallet;
    this._isConnecting = true;

    try {
      // Step 1: Start listening for popup result via BroadcastChannel.
      // Must be set up BEFORE popup opens to avoid race condition.
      const popupResultPromise = this.waitForPopupResult();

      // Step 2: Open popup SYNCHRONOUSLY (user gesture context).
      // Any await before this would expire the gesture and block the popup.
      this.popupManager.openPopup('connect');

      // Step 3: Create iframe + encrypted channel IN PARALLEL with popup.
      // The user is interacting with the popup while the iframe loads.
      const [popupResponse, channel] = await Promise.all([
        popupResultPromise,
        this.iframeManager.connect(this.config.contracts, this.nodeUrl),
      ]);

      if (popupResponse.type !== 'auth-keys') {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 4: Send keys to iframe to initialize PXE
      this.pxeProxy = new PXEProxy(channel);
      const result = (await this.pxeProxy.call('initWithKeys', [popupResponse])) as { address: string };
      this._address = result.address;

      this.wallet = this.pxeProxy.createInterface<Wallet>();
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

  /** Listen for popup result via BroadcastChannel (same-origin). */
  private waitForPopupResult(): Promise<PopupResponse> {
    return new Promise((resolve, reject) => {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      const timeout = setTimeout(() => {
        bc.close();
        reject(new Error('Popup did not respond within 120 seconds'));
      }, 120_000);

      bc.onmessage = (event) => {
        if (event.data?.type === 'popup-result') {
          clearTimeout(timeout);
          bc.close();
          resolve(event.data.response as PopupResponse);
        } else if (event.data?.type === 'popup-cancelled') {
          clearTimeout(timeout);
          bc.close();
          reject(new Error('User cancelled'));
        }
      };
    });
  }
}
