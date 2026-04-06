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
  const [rpId, setRpId] = useState<string | undefined>();
  const [context, setContext] = useState<TxSummary | ReadSummary | undefined>();
  const [credentialId, setCredentialId] = useState<ArrayBuffer | undefined>();

  useEffect(() => {
    const handleInit = (event: MessageEvent) => {
      const data = event.data as PopupInitMessage;
      if (data?.type !== 'POPUP_INIT') return false;
      setFlow(data.flow);
      setRpId(data.rpId);
      setContext(data.context);
      setCredentialId(data.credentialId);
      if (event.ports[0]) setPort(event.ports[0]);
      return true;
    };

    // Check for early messages captured before React mounted.
    // The SDK sends POPUP_INIT immediately after window.open(), which often
    // arrives before useEffect runs. popup.html buffers these in __earlyMessages.
    const earlyMessages = (window as any).__earlyMessages as MessageEvent[] | undefined;
    if (earlyMessages && earlyMessages.length > 0) {
      for (const msg of earlyMessages) {
        if (handleInit(msg)) {
          earlyMessages.length = 0;
          return;
        }
      }
    }

    // No early message found — listen for late arrivals
    const onMessage = (event: MessageEvent) => {
      if (handleInit(event)) {
        window.removeEventListener('message', onMessage);
      }
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
          rpId={rpId}
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
