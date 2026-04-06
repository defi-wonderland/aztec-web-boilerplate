import type { PopupFlow, PopupResponse, TxSummary, ReadSummary } from '../shared/types';

/**
 * Opens popup windows from the SDK (dapp) context.
 *
 * Communication architecture (COOP: same-origin compatible):
 *   SDK (dapp origin) cannot talk to popup (wallet host origin) via postMessage
 *   because COOP: same-origin severs the browsing context group.
 *
 *   Instead, the popup communicates with the iframe (same wallet host origin)
 *   via BroadcastChannel, and the iframe relays to the SDK via SecureChannel.
 *
 * Flow:
 *   1. SDK tells iframe "I need a popup" via SecureChannel
 *   2. SDK opens popup (user gesture context) at wallet host
 *   3. Popup does passkey ceremony
 *   4. Popup sends result to iframe via BroadcastChannel (same origin)
 *   5. Iframe relays result to SDK via SecureChannel
 *   6. SDK resolves
 *
 * This class only handles step 2 (opening the popup) and step 6 (resolving).
 * The actual relay is handled by RPCHandler in the iframe.
 */
export class PopupManager {
  constructor(private walletHost: string, private rpId?: string) {}

  openPopup(flow: PopupFlow, context?: TxSummary | ReadSummary): void {
    const url = new URL(`/popup.html`, this.walletHost);
    url.searchParams.set('flow', flow);
    if (this.rpId) url.searchParams.set('rpId', this.rpId);
    if (context) {
      url.searchParams.set('context', btoa(JSON.stringify(context)));
    }
    const popup = window.open(url.toString(), '_blank', 'width=420,height=520,popup=yes');
    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site to use the Aztec wallet.');
    }
  }
}
