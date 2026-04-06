import type { PopupFlow, PopupResponse, PopupInitMessage, TxSummary, ReadSummary } from '../shared/types';

/**
 * Opens popup windows from the SDK (dapp) context.
 *
 * Flow:
 * 1. SDK opens popup via window.open() (user gesture context)
 * 2. popup.html loads, sends POPUP_READY to window.opener
 * 3. SDK receives POPUP_READY, sends POPUP_INIT with MessagePort
 * 4. Popup receives POPUP_INIT (via early buffer or React listener)
 * 5. Popup does its work, sends result on the MessagePort
 * 6. SDK resolves the promise with the result
 *
 * Requires COOP: same-origin-allow-popups on the dapp (not same-origin)
 * so that window.opener is available in the cross-origin popup.
 */
export class PopupManager {
  constructor(private walletHost: string, private rpId?: string) {}

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
        rpId: this.rpId,
        context,
        credentialId: credentialId ? Array.from(credentialId).map(b => String.fromCharCode(b)).join('') : undefined,
      };

      // Wait for POPUP_READY from the popup before sending INIT.
      // popup.html sends this synchronously on load (before React).
      // This ensures the popup page has loaded (not about:blank) and
      // the early message buffer is registered.
      const onReady = (event: MessageEvent) => {
        if (event.data?.type !== 'POPUP_READY') return;
        // Verify it came from our popup (not some other window)
        if (event.source !== popup) return;
        window.removeEventListener('message', onReady);

        // Now safe to send INIT — popup.html is loaded and buffering
        try {
          popup.postMessage(initMsg, popupOrigin, [port2]);
        } catch (e) {
          reject(new Error(`Failed to send POPUP_INIT: ${e}`));
        }
      };
      window.addEventListener('message', onReady);

      // Detect popup close without completing
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener('message', onReady);
          port1.close();
          reject(new Error('Popup closed without completing'));
        }
      }, 500);

      // Listen for response from popup
      port1.onmessage = (event: MessageEvent) => {
        clearInterval(pollClosed);
        window.removeEventListener('message', onReady);
        port1.close();
        resolve(event.data as PopupResponse);
      };
    });
  }
}
