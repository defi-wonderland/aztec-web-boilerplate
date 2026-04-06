import type { PopupFlow, PopupResponse, PopupInitMessage, TxSummary, ReadSummary } from '../shared/types';

export class PopupOrchestrator {
  constructor(private walletOrigin: string) {}

  async openPopup(
    flow: PopupFlow,
    context?: TxSummary | ReadSummary,
    credentialId?: Uint8Array,
  ): Promise<PopupResponse> {
    const url = `${this.walletOrigin}/popup.html?flow=${flow}`;
    const popup = window.open(url, '_blank', 'width=400,height=500,popup=yes');
    if (!popup) throw new Error('Popup blocked. Please allow popups for this site.');

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
        popup.postMessage(initMsg, this.walletOrigin, [port2]);
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
