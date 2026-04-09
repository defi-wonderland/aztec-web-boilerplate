import type { Wallet } from '@aztec/aztec.js';
import type { PasskeyWalletConfig, PopupResponse, RuntimePromptSummary } from '../shared/types';
import { DEFAULT_WALLET_HOST, NETWORK_URLS } from '../shared/constants';
import { IframeManager } from './IframeManager';
import { PXEProxy } from './PXEProxy';
import { PopupManager } from './PopupManager';
import { createWalletProxy } from './WalletProxy';

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
   * 1. Open popup (synchronous — user gesture) + start popup result promise
   * 2. Create iframe + encrypted channel (parallel with popup)
   * 3. Popup does passkey ceremony, redirects to dapp origin with result
   * 4. SDK reads result from popup URL (OAuth callback pattern)
   * 5. SDK sends keys to iframe via encrypted channel
   * 6. Iframe initializes PXE, registers account, returns address
   */
  async connect(manifest?: unknown): Promise<{ wallet: Wallet; capabilities: unknown }> {
    if (this.wallet) return { wallet: this.wallet, capabilities: this.buildCapabilitiesResponse(manifest) };
    this._isConnecting = true;

    try {
      // Check for stored credential ID (returning user)
      const storedCredentialId = localStorage.getItem('aztec-wallet:sdk-credential-id');

      // Step 1: Open popup and start listening for result.
      // openPopup must be called synchronously (user gesture).
      const popupResultPromise = this.popupManager.openPopup(
        'connect',
        undefined,
        storedCredentialId ?? undefined,
        manifest,
      );

      // Step 2: Create iframe + encrypted channel in parallel with popup
      const [popupResponse, channel] = await Promise.all([
        popupResultPromise,
        this.iframeManager.connect(this.config.contracts, this.nodeUrl),
      ]);

      if (popupResponse.type !== 'auth-keys') {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 3: Store credential ID for returning visits
      if (popupResponse.credentialId) {
        localStorage.setItem('aztec-wallet:sdk-credential-id', popupResponse.credentialId);
      }

      // Step 4: Send keys to iframe to initialize PXE (with manifest for capability grants)
      this.pxeProxy = new PXEProxy(channel);
      const result = (await this.pxeProxy.call('initWithKeys', [popupResponse, manifest])) as { address: string };
      this._address = result.address;

      // Register SDK-side handler for runtime prompt requests from iframe
      channel.onRequest(async (method: string, params: unknown[]) => {
        if (method === 'runtime-prompt') {
          const summary = params[0] as RuntimePromptSummary;
          const response = await this.popupManager.openPopup('runtime-prompt', summary);
          return response.type === 'prompt-approved';
        }
        throw new Error(`Unknown SDK request: ${method}`);
      });

      this.wallet = createWalletProxy(channel);
      return { wallet: this.wallet, capabilities: this.buildCapabilitiesResponse(manifest) };
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

  private buildCapabilitiesResponse(manifest?: unknown): unknown {
    if (!manifest || typeof manifest !== 'object') {
      return { version: '1.0', granted: [], wallet: { name: 'Passkey Wallet', version: '1.0.0' } };
    }
    // v1: grant exactly what was requested (no narrowing)
    const m = manifest as { capabilities?: unknown[] };
    return {
      version: '1.0',
      granted: m.capabilities ?? [],
      wallet: { name: 'Passkey Wallet', version: '1.0.0' },
    };
  }

  getWallet(): Wallet | null { return this.wallet; }
  getAddress(): string | null { return this._address; }
}
