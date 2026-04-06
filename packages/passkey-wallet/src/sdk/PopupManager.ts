import type { PopupFlow, PopupResponse, TxSummary, ReadSummary } from '../shared/types';

const CALLBACK_KEY = 'aztec-wallet:callback-result';

/**
 * Opens popup windows from the SDK (dapp) context.
 *
 * Communication flow (COOP: same-origin compatible):
 * 1. SDK clears callback localStorage key, opens popup at wallet host
 * 2. Popup does passkey ceremony at wallet host origin (cross-origin)
 * 3. Popup redirects to dapp_origin/__wallet_callback.html#base64(result)
 * 4. Callback page writes the hash to localStorage (same-origin with SDK)
 * 5. SDK polls localStorage until the result appears
 *
 * This works because:
 * - localStorage is shared between the callback page and the SDK (same origin)
 * - No window.opener needed (COOP severs it for cross-origin popups)
 * - No BroadcastChannel needed (COOP isolates browsing context groups)
 */
export class PopupManager {
  constructor(
    private walletHost: string,
    private rpId?: string,
  ) {}

  openPopup(
    flow: PopupFlow,
    context?: TxSummary | ReadSummary,
  ): Promise<PopupResponse> {
    // Clear any stale result before opening
    localStorage.removeItem(CALLBACK_KEY);

    const url = new URL('/popup.html', this.walletHost);
    url.searchParams.set('flow', flow);
    url.searchParams.set('callback', window.location.origin);
    if (this.rpId) url.searchParams.set('rpId', this.rpId);
    if (context) url.searchParams.set('context', btoa(JSON.stringify(context)));

    const popup = window.open(url.toString(), '_blank', 'width=420,height=520,popup=yes');
    if (!popup) {
      return Promise.reject(
        new Error('Popup blocked. Please allow popups for this site.'),
      );
    }

    return new Promise<PopupResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Popup did not complete within 120 seconds'));
      }, 120_000);

      // Poll localStorage for the callback result.
      // The callback page (__wallet_callback.html) writes to localStorage
      // after the popup redirects there from the wallet host.
      const poll = setInterval(() => {
        const raw = localStorage.getItem(CALLBACK_KEY);
        if (raw) {
          clearInterval(poll);
          clearTimeout(timeout);
          localStorage.removeItem(CALLBACK_KEY);
          try {
            const response = JSON.parse(atob(raw)) as PopupResponse;
            resolve(response);
          } catch {
            reject(new Error('Failed to decode popup response'));
          }
        }
      }, 200);
    });
  }
}
