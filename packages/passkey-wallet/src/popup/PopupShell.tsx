import { useEffect, useState, useCallback } from 'react';
import type {
  PopupInitMessage,
  PopupResponse,
  PopupFlow,
  TxSummary,
  ReadSummary,
} from '../shared/types';
import { ConnectFlow } from './ConnectFlow';
import { SignFlow } from './SignFlow';
import { ReadFlow } from './ReadFlow';
import { loadingStyles } from './styles';

/* ---------------------------------------------------------------------------
   Styles
   --------------------------------------------------------------------------- */

const styles = {
  loadingShell: loadingStyles.shell,
  loadingSpinner: loadingStyles.spinner,
  loadingText: loadingStyles.text,
} as const;

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function PopupShell() {
  const [port, setPort] = useState<MessagePort | null>(null);
  const [flow, setFlow] = useState<PopupFlow | null>(null);
  const [context, setContext] = useState<TxSummary | ReadSummary | undefined>();
  const [credentialId, setCredentialId] = useState<ArrayBuffer | undefined>();

  useEffect(() => {
    // Listen for POPUP_INIT from the SDK (dapp).
    // Note: window.opener is null because the dapp has COOP: same-origin.
    // The SDK sends POPUP_INIT directly via popup.postMessage() on a retry
    // loop, so we just need to listen — no POPUP_READY handshake needed.
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

  const handleComplete = useCallback(
    (response: PopupResponse) => {
      port?.postMessage(response);
      window.close();
    },
    [port],
  );

  const handleCancel = useCallback(() => {
    window.close();
  }, []);

  // Waiting for POPUP_INIT — show a minimal loading shell
  if (!flow || !port) {
    return (
      <div className={styles.loadingShell} data-testid="popup-loading">
        <span
          className={styles.loadingSpinner}
          role="status"
          aria-label="Loading wallet"
        />
        <p className={styles.loadingText}>Loading wallet…</p>
      </div>
    );
  }

  switch (flow) {
    case 'connect':
      return (
        <ConnectFlow
          credentialId={credentialId}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
    case 'sign':
      return (
        <SignFlow
          summary={context as TxSummary}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
    case 'read':
      return (
        <ReadFlow
          summary={context as ReadSummary}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
  }
}
