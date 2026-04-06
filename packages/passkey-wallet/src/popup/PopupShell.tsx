import { useEffect, useState, useCallback } from 'react';
import type { PopupInitMessage, PopupResponse, PopupFlow, TxSummary, ReadSummary } from '../shared/types';
import { ConnectFlow } from './ConnectFlow';
import { SignFlow } from './SignFlow';
import { ReadFlow } from './ReadFlow';

export function PopupShell() {
  const [port, setPort] = useState<MessagePort | null>(null);
  const [flow, setFlow] = useState<PopupFlow | null>(null);
  const [context, setContext] = useState<TxSummary | ReadSummary | undefined>();
  const [credentialId, setCredentialId] = useState<ArrayBuffer | undefined>();

  useEffect(() => {
    if (window.opener) window.opener.postMessage({ type: 'POPUP_READY' }, '*');

    const onMessage = (event: MessageEvent) => {
      const data = event.data as PopupInitMessage;
      if (data?.type !== 'POPUP_INIT') return;
      window.removeEventListener('message', onMessage);
      setFlow(data.flow);
      setContext(data.context);
      setCredentialId(data.credentialId);
      if (event.ports[0]) setPort(event.ports[0]);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleComplete = useCallback((response: PopupResponse) => {
    port?.postMessage(response);
    window.close();
  }, [port]);

  const handleCancel = useCallback(() => {
    window.close();
  }, []);

  if (!flow || !port) return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading...</div>;

  switch (flow) {
    case 'connect': return <ConnectFlow credentialId={credentialId} onComplete={handleComplete} onCancel={handleCancel} />;
    case 'sign': return <SignFlow summary={context as TxSummary} onComplete={handleComplete} onCancel={handleCancel} />;
    case 'read': return <ReadFlow summary={context as ReadSummary} onComplete={handleComplete} onCancel={handleCancel} />;
  }
}
