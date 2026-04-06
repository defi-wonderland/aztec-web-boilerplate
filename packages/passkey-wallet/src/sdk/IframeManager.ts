import { SecureChannel } from '../shared/SecureChannel';
import { DEFAULT_WALLET_HOST } from '../shared/constants';
import type { ContractConfig } from '../shared/types';

export class IframeManager {
  private iframe: HTMLIFrameElement | null = null;
  private channel: SecureChannel | null = null;

  constructor(private walletHost: string = DEFAULT_WALLET_HOST) {}

  async connect(contracts: ContractConfig[]): Promise<SecureChannel> {
    this.iframe = document.createElement('iframe');
    this.iframe.src = this.walletHost;
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    document.body.appendChild(this.iframe);

    await new Promise<void>((resolve) => {
      this.iframe!.addEventListener('load', () => resolve(), { once: true });
    });

    const { port1, port2 } = new MessageChannel();
    this.iframe.contentWindow!.postMessage(
      { type: 'INIT', contracts },
      this.walletHost,
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
