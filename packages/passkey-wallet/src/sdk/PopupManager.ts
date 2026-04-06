import type { PopupFlow, PopupResponse, PopupInitMessage, TxSummary, ReadSummary } from '../shared/types';

/**
 * Opens popup windows from the SDK (dapp) context.
 *
 * Popups must be opened from the dapp, not the iframe, because browsers
 * only allow window.open() from a direct user gesture context. The iframe
 * host has no user gesture — it received an RPC message over MessagePort.
 *
 * Flow:
 * 1. SDK calls connect() → user clicks button (user gesture)
 * 2. SDK opens popup immediately (within gesture context)
 * 3. SDK transfers a MessagePort to the popup
 * 4. Popup does its work (passkey ceremony, approval, etc.)
 * 5. Popup sends result back via the port
 */
export class PopupManager {
  constructor(private walletHost: string) {}

  async openPopup(
    flow: PopupFlow,
    context?: TxSummary | ReadSummary,
    credentialId?: Uint8Array,
  ): Promise<PopupResponse> {
    const url = `${this.walletHost}/popup.html?flow=${flow}`;
    const popup = window.open(url, '_blank', 'width=420,height=520,popup=yes');

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site to use the Aztec wallet.');
    }

    return new Promise<PopupResponse>((resolve, reject) => {
      const { port1, port2 } = new MessageChannel();

      const onReady = (event: MessageEvent) => {
        if (event.source !== popup || event.data?.type !== 'POPUP_READY') return;
        window.removeEventListener('message', onReady);

        const initMsg: PopupInitMessage = {
          type: 'POPUP_INIT',
          flow,
          context,
          credentialId: credentialId?.buffer,
        };
        popup.postMessage(initMsg, new URL(this.walletHost).origin, [port2]);
      };
      window.addEventListener('message', onReady);

      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener('message', onReady);
          port1.close();
          reject(new Error('Popup closed without completing'));
        }
      }, 500);

      port1.onmessage = (event: MessageEvent) => {
        clearInterval(pollClosed);
        port1.close();
        resolve(event.data as PopupResponse);
      };
    });
  }
}
