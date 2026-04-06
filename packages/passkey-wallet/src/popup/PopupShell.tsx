import { useEffect, useState, useCallback } from 'react';
import type {
  PopupResponse,
  PopupFlow,
  TxSummary,
  ReadSummary,
} from '../shared/types';
import { ConnectFlow } from './ConnectFlow';
import { SignFlow } from './SignFlow';
import { ReadFlow } from './ReadFlow';
import { loadingStyles } from './styles';

const BROADCAST_CHANNEL_NAME = 'aztec-wallet-popup';

const styles = {
  loadingShell: loadingStyles.shell,
  loadingSpinner: loadingStyles.spinner,
  loadingText: loadingStyles.text,
} as const;

export function PopupShell() {
  const [flow, setFlow] = useState<PopupFlow | null>(null);
  const [rpId, setRpId] = useState<string | undefined>();
  const [context, setContext] = useState<TxSummary | ReadSummary | undefined>();
  const [credentialId, setCredentialId] = useState<ArrayBuffer | undefined>();
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);

  useEffect(() => {
    // Read flow and context from URL params (set by PopupManager)
    const params = new URLSearchParams(window.location.search);
    const flowParam = params.get('flow') as PopupFlow | null;
    const rpIdParam = params.get('rpId');
    const contextParam = params.get('context');

    if (flowParam) {
      setFlow(flowParam);
      if (rpIdParam) setRpId(rpIdParam);
      if (contextParam) {
        try { setContext(JSON.parse(atob(contextParam))); } catch {}
      }
    }

    // Open BroadcastChannel to communicate with the iframe (same origin)
    const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    setChannel(bc);

    // Listen for credentialId from iframe (for returning users)
    bc.onmessage = (event) => {
      if (event.data?.type === 'credential-id') {
        setCredentialId(event.data.credentialId);
      }
    };

    // Tell iframe the popup is open
    bc.postMessage({ type: 'popup-opened', flow: flowParam });

    return () => bc.close();
  }, []);

  const handleComplete = useCallback(
    (response: PopupResponse) => {
      // Send result to iframe via BroadcastChannel (same origin, COOP-safe)
      channel?.postMessage({ type: 'popup-result', response });
      window.close();
    },
    [channel],
  );

  const handleCancel = useCallback(() => {
    channel?.postMessage({ type: 'popup-cancelled' });
    window.close();
  }, [channel]);

  if (!flow || !channel) {
    return (
      <div className={styles.loadingShell} data-testid="popup-loading">
        <span className={styles.loadingSpinner} role="status" aria-label="Loading wallet" />
        <p className={styles.loadingText}>Loading wallet...</p>
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
