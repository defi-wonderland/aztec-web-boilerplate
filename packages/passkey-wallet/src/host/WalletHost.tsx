import { useEffect, useRef } from 'react';
import { SecureChannel } from '../shared/SecureChannel';
import { PXEManager } from './PXEManager';
import { PopupOrchestrator } from './PopupOrchestrator';
import { CredentialStore } from './CredentialStore';
import { RPCHandler } from './RPCHandler';

export function WalletHost() {
  const channelRef = useRef<SecureChannel | null>(null);

  useEffect(() => {
    const walletOrigin = window.location.origin;
    const pxeManager = new PXEManager();
    const popupOrchestrator = new PopupOrchestrator(walletOrigin);
    const credentialStore = new CredentialStore();

    const onMessage = async (event: MessageEvent) => {
      if (event.data?.type !== 'INIT') return;
      const port = event.ports[0];
      if (!port) return;
      window.removeEventListener('message', onMessage);

      const channel = new SecureChannel('i2p');
      await channel.initFromPort(port);
      channelRef.current = channel;

      const contractConfigs = event.data.contracts ?? [];
      const handler = new RPCHandler(pxeManager, popupOrchestrator, credentialStore, contractConfigs);
      handler.register(channel);
    };

    window.addEventListener('message', onMessage);

    // Signal to the parent SDK that we're ready to receive INIT
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'WALLET_HOST_READY' }, '*');
    }

    return () => {
      window.removeEventListener('message', onMessage);
      channelRef.current?.destroy();
      pxeManager.destroy();
    };
  }, []);

  return null;
}
