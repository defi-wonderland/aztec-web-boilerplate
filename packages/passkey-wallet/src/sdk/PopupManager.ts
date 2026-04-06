import type { PopupFlow, PopupResponse, TxSummary, ReadSummary } from '../shared/types';

/**
 * Opens popup windows from the SDK (dapp) context.
 *
 * Communication uses the OAuth callback pattern:
 * 1. SDK opens popup at wallet host with callback=dapp_origin in URL
 * 2. Popup does passkey ceremony at wallet host origin
 * 3. Popup redirects to dapp_origin/__wallet_callback.html#base64(result)
 * 4. SDK polls the popup's URL for the callback, reads the fragment
 *
 * This works regardless of COOP/COEP because the popup navigates
 * to the dapp's origin, making the final page same-origin with the SDK.
 */
export class PopupManager {
  constructor(private walletHost: string, private rpId?: string) {}

  openPopup(flow: PopupFlow, context?: TxSummary | ReadSummary): Promise<PopupResponse> {
    const url = new URL('/popup.html', this.walletHost);
    url.searchParams.set('flow', flow);
    url.searchParams.set('callback', window.location.origin);
    if (this.rpId) url.searchParams.set('rpId', this.rpId);
    if (context) url.searchParams.set('context', btoa(JSON.stringify(context)));

    const popup = window.open(url.toString(), '_blank', 'width=420,height=520,popup=yes');
    if (!popup) {
      return Promise.reject(new Error('Popup blocked. Please allow popups for this site.'));
    }

    return new Promise<PopupResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Popup did not complete within 120 seconds'));
      }, 120_000);

      // Poll the popup's URL for the callback redirect.
      // When the popup navigates to dapp_origin/__wallet_callback.html#result,
      // it becomes same-origin and we can read the hash.
      const poll = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(poll);
            clearTimeout(timeout);
            reject(new Error('Popup closed without completing'));
            return;
          }
          // This throws while the popup is cross-origin. Once it redirects
          // to our origin (/__wallet_callback.html), it becomes readable.
          const popupUrl = popup.location.href;
          if (popupUrl.includes('__wallet_callback.html#')) {
            clearInterval(poll);
            clearTimeout(timeout);
            const hash = popupUrl.split('#')[1];
            const response = JSON.parse(atob(hash)) as PopupResponse;
            popup.close();
            resolve(response);
          }
        } catch {
          // Cross-origin — can't read location yet. Keep polling.
        }
      }, 200);
    });
  }
}
