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
   * Connect flow — entirely inside the iframe modal (no popup):
   * 1. Create iframe + encrypted channel
   * 2. Show iframe as modal → permission review (if manifest) → biometric
   * 3. Receive auth-keys from iframe via postMessage
   * 4. Send keys + manifest to iframe via encrypted channel
   * 5. Iframe initializes PXE, stores capability grants, registers account
   */
  async connect(manifest?: unknown): Promise<{ wallet: Wallet; capabilities: unknown }> {
    if (this.wallet) return { wallet: this.wallet, capabilities: this.buildCapabilitiesResponse(manifest) };
    this._isConnecting = true;

    try {
      // Step 1: Create iframe + encrypted channel
      const channel = await this.iframeManager.connect(this.config.contracts, this.nodeUrl);

      // Step 2: Run full connect ceremony in iframe modal
      const popupResponse = await this.runConnectInIframe(manifest);

      if (popupResponse.type !== 'auth-keys') {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 3: Store credential ID for returning visits
      if (popupResponse.credentialId) {
        localStorage.setItem('aztec-wallet:sdk-credential-id', popupResponse.credentialId);
      }

      // Step 4: Send keys + manifest to iframe to initialize PXE
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

  /**
   * Run the full connect ceremony inside the iframe modal:
   * - Shows iframe as modal overlay
   * - Sends START_CONNECT with manifest + rpId
   * - WalletHost renders: PermissionReview (if manifest) → ConnectFlow (biometric)
   * - Waits for CONNECT_AUTH_RESULT or CONNECT_REJECTED from iframe
   * - Hides iframe modal
   */
  private runConnectInIframe(manifest?: unknown): Promise<PopupResponse> {
    return new Promise<PopupResponse>((resolve, reject) => {
      this.iframeManager.showAsModal();

      const iframe = this.iframeManager.getIframe();
      if (!iframe?.contentWindow) {
        this.iframeManager.hideModal();
        reject(new Error('Iframe not available'));
        return;
      }

      // Tell the iframe to start the connect ceremony
      iframe.contentWindow.postMessage({
        type: 'START_CONNECT',
        manifest,
        rpId: this.config.rpId,
      }, '*');

      // Listen for results from the iframe
      const onResponse = (event: MessageEvent) => {
        if (event.data?.type === 'CONNECT_AUTH_RESULT') {
          window.removeEventListener('message', onResponse);
          this.iframeManager.hideModal();
          resolve(event.data.response as PopupResponse);
        } else if (event.data?.type === 'CONNECT_REJECTED') {
          window.removeEventListener('message', onResponse);
          this.iframeManager.hideModal();
          resolve({ type: 'tx-cancelled' });
        }
      };
      window.addEventListener('message', onResponse);
    });
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
