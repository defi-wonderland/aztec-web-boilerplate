import type { Wallet } from '@aztec/aztec.js';
import type { PasskeyWalletConfig, RuntimePromptSummary } from '../shared/types';
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
   * 1. Create iframe + encrypted channel
   * 2. If manifest: show iframe as modal for capability review, wait for approval
   * 3. Open popup for biometric (passkey ceremony) — no manifest in popup
   * 4. Send keys + manifest to iframe via encrypted channel
   * 5. Iframe initializes PXE, stores capability grants, registers account
   */
  async connect(manifest?: unknown): Promise<{ wallet: Wallet; capabilities: unknown }> {
    if (this.wallet) return { wallet: this.wallet, capabilities: this.buildCapabilitiesResponse(manifest) };
    this._isConnecting = true;

    try {
      // Step 1: Create iframe + encrypted channel
      const channel = await this.iframeManager.connect(this.config.contracts, this.nodeUrl);

      // Step 2: If manifest provided, show capability review in iframe modal
      if (manifest) {
        const approved = await this.reviewCapabilitiesInIframe(manifest);
        if (!approved) {
          throw new Error('Capability review rejected by user');
        }
      }

      // Step 3: Open popup for biometric only (no manifest — review already done)
      const storedCredentialId = localStorage.getItem('aztec-wallet:sdk-credential-id');
      const popupResponse = await this.popupManager.openPopup(
        'connect',
        undefined,
        storedCredentialId ?? undefined,
      );

      if (popupResponse.type !== 'auth-keys') {
        throw new Error('Passkey authentication cancelled');
      }

      // Step 4: Store credential ID for returning visits
      if (popupResponse.credentialId) {
        localStorage.setItem('aztec-wallet:sdk-credential-id', popupResponse.credentialId);
      }

      // Step 5: Send keys + manifest to iframe to initialize PXE
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
   * Show the iframe as a modal overlay, send the manifest for review,
   * and wait for the user's decision.
   */
  private reviewCapabilitiesInIframe(manifest: unknown): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Show iframe as modal
      this.iframeManager.showAsModal();

      // Send manifest to iframe for review
      const iframe = this.iframeManager.getIframe();
      if (!iframe?.contentWindow) {
        this.iframeManager.hideModal();
        resolve(false);
        return;
      }
      iframe.contentWindow.postMessage({ type: 'REVIEW_CAPABILITIES', manifest }, '*');

      // Listen for approval/rejection from iframe
      const onResponse = (event: MessageEvent) => {
        if (event.data?.type === 'CAPABILITIES_APPROVED') {
          window.removeEventListener('message', onResponse);
          this.iframeManager.hideModal();
          resolve(true);
        } else if (event.data?.type === 'CAPABILITIES_REJECTED') {
          window.removeEventListener('message', onResponse);
          this.iframeManager.hideModal();
          resolve(false);
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
