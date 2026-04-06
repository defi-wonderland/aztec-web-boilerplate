import { SecureChannel } from '../shared/SecureChannel';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import type { ContractConfig } from '../shared/types';

export class IframeManager {
  private iframe: HTMLIFrameElement | null = null;
  private channel: SecureChannel | null = null;

  constructor(private walletHost: string = DEFAULT_WALLET_HOST) {}

  async connect(contracts: ContractConfig[]): Promise<SecureChannel> {
    // Parse the wallet host to separate origin from path
    const hostUrl = new URL(this.walletHost);
    const origin = hostUrl.origin; // e.g. "http://localhost:3001"

    // Build the full iframe URL — append /host.html if path is just root
    if (hostUrl.pathname === '/') {
      hostUrl.pathname = '/host.html';
    }

    this.iframe = document.createElement('iframe');
    this.iframe.src = hostUrl.toString();
    this.iframe.style.display = 'none';
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
      { type: 'INIT', contracts },
      '*',
      [port2],
    );

    this.channel = new SecureChannel('p2i');
    await this.channel.initFromPort(port1);
    return this.channel;
  }

  disconnect(): void {
    this.channel?.destroy();
    this.channel = null;
    if (this.iframe) { this.iframe.remove(); this.iframe = null; }
  }

  getChannel(): SecureChannel | null { return this.channel; }
}
