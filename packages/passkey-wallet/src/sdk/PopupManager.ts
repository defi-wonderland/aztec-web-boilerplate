import type { PopupFlow, PopupResponse, PopupInitMessage, TxSummary, ReadSummary } from '../shared/types';

/**
 * Opens popup windows from the SDK (dapp) context.
 *
 * Communication challenge: the main app has COOP: same-origin (required for
 * SharedArrayBuffer), which makes window.opener null in cross-origin popups.
 * So the popup can't signal back to us via opener.postMessage().
 *
 * Solution: SDK sends POPUP_INIT to the popup on a retry interval until
 * the popup acknowledges by sending a response on the transferred MessagePort.
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

    const popupOrigin = new URL(this.walletHost).origin;

    return new Promise<PopupResponse>((resolve, reject) => {
      const { port1, port2 } = new MessageChannel();

      const initMsg: PopupInitMessage = {
        type: 'POPUP_INIT',
        flow,
        context,
        credentialId: credentialId?.buffer,
      };

      // Retry sending POPUP_INIT until the popup is loaded and listening.
      // We can't rely on POPUP_READY from the popup because COOP: same-origin
      // on our page makes window.opener null in the cross-origin popup.
      let portTransferred = false;
      const sendInit = setInterval(() => {
        if (popup.closed) {
          clearInterval(sendInit);
          return;
        }
        if (!portTransferred) {
          try {
            // Transfer the port on the first successful send
            popup.postMessage(initMsg, popupOrigin, [port2]);
            portTransferred = true;
            clearInterval(sendInit);
          } catch {
            // popup not ready yet, retry
          }
        }
      }, 200);

      // Detect popup close without response
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          clearInterval(sendInit);
          port1.close();
          reject(new Error('Popup closed without completing'));
        }
      }, 500);

      // Listen for response from popup
      port1.onmessage = (event: MessageEvent) => {
        clearInterval(pollClosed);
        clearInterval(sendInit);
        port1.close();
        resolve(event.data as PopupResponse);
      };
    });
  }
}
