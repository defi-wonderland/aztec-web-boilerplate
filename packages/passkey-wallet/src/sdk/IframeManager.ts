import { SecureChannel } from '../shared/SecureChannel';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import type { ContractConfig } from '../shared/types';

export class IframeManager {
  private iframe: HTMLIFrameElement | null = null;
  private channel: SecureChannel | null = null;
  private backdrop: HTMLDivElement | null = null;

  constructor(private walletHost: string = DEFAULT_WALLET_HOST) { }

  async connect(
    contracts: ContractConfig[],
    nodeUrl: string,
  ): Promise<SecureChannel> {
    const hostUrl = new URL(this.walletHost);

    // Build the iframe URL
    if (hostUrl.pathname === '/') {
      hostUrl.pathname = '/host.html';
    }

    this.iframe = document.createElement('iframe');
    this.iframe.src = hostUrl.toString();
    this.iframe.style.display = 'none';

    // credentialless: allows the cross-origin iframe to load under the
    // dapp's COEP headers. The iframe main thread won't have
    // crossOriginIsolated, but PXE runs in a Worker which does.
    (this.iframe as any).credentialless = true;
    // No sandbox attribute — the iframe needs full access to IndexedDB,
    // WebSocket, and window.open for popups. Cross-origin isolation
    // provides the security boundary.
    this.iframe.setAttribute('allow', 'publickey-credentials-get; publickey-credentials-create');
    document.body.appendChild(this.iframe);

    // Wait for the iframe's React app to mount and signal readiness.
    // The iframe 'load' event fires when the HTML loads, but React's
    // useEffect (which registers the message listener) runs later.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', onReady);
        reject(new Error('Wallet host did not signal READY within 15s'));
      }, 15_000);

      const onReady = (event: MessageEvent) => {
        if (event.data?.type !== 'WALLET_HOST_READY') return;
        window.removeEventListener('message', onReady);
        clearTimeout(timeout);
        resolve();
      };

      window.addEventListener('message', onReady);
    });

    if (!this.iframe.contentWindow) {
      throw new Error(`Wallet host iframe failed to load: ${hostUrl.toString()}`);
    }

    const { port1, port2 } = new MessageChannel();
    // Use '*' because cross-origin iframes under COEP: credentialless
    // report origin as 'null'. Safe because INIT only transfers a
    // MessagePort — the encrypted SecureChannel provides authentication.
    this.iframe.contentWindow.postMessage(
      { type: 'INIT', contracts, nodeUrl },
      '*',
      [port2],
    );

    this.channel = new SecureChannel('p2i');
    await this.channel.initFromPort(port1);
    return this.channel;
  }

  /** Show the iframe as a centered modal overlay with backdrop */
  showAsModal(): void {
    if (!this.iframe) return;
    Object.assign(this.iframe.style, {
      display: 'block',
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '400px',
      height: '600px',
      maxHeight: '90vh',
      border: 'none',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      zIndex: '10000',
    });
    // Create backdrop
    if (!this.backdrop) {
      this.backdrop = document.createElement('div');
      Object.assign(this.backdrop.style, {
        position: 'fixed',
        inset: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: '9999',
      });
      document.body.appendChild(this.backdrop);
    }
  }

  /** Hide the iframe back to invisible */
  hideModal(): void {
    if (this.iframe) {
      this.iframe.style.display = 'none';
    }
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
  }

  disconnect(): void {
    this.channel?.destroy();
    this.channel = null;
    this.hideModal();
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  getChannel(): SecureChannel | null { return this.channel; }
  getIframe(): HTMLIFrameElement | null { return this.iframe; }
}
