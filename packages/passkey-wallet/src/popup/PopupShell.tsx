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
import { RuntimePrompt } from './RuntimePrompt';
import type { RuntimePromptSummary } from '../shared/types';
import { loadingStyles, popupGlobalCSS } from './styles';

const styles = {
  loadingShell: loadingStyles.shell,
  loadingSpinner: loadingStyles.spinner,
  loadingText: loadingStyles.text,
} as const;

export function PopupShell() {
  const [flow, setFlow] = useState<PopupFlow | null>(null);
  const [rpId, setRpId] = useState<string | undefined>();
  const [callbackOrigin, setCallbackOrigin] = useState<string>('');
  const [context, setContext] = useState<TxSummary | ReadSummary | undefined>();
  const [credentialId, setCredentialId] = useState<ArrayBuffer | undefined>();
  const [manifest, setManifest] = useState<{ metadata: { name: string; url?: string }; capabilities: unknown[] } | undefined>();

  // Inject global CSS on mount
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = popupGlobalCSS;
    document.head.appendChild(styleEl);
    return () => { document.head.removeChild(styleEl); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowParam = params.get('flow') as PopupFlow | null;
    const rpIdParam = params.get('rpId');
    const callbackParam = params.get('callback');
    const contextParam = params.get('context');

    const credentialIdParam = params.get('credentialId');

    if (flowParam) setFlow(flowParam);
    if (rpIdParam) setRpId(rpIdParam);
    if (callbackParam) setCallbackOrigin(callbackParam);
    if (credentialIdParam) {
      // Decode base64 credential ID to ArrayBuffer for ConnectFlow
      try {
        const binary = atob(credentialIdParam);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        setCredentialId(bytes.buffer);
      } catch { /* invalid base64, treat as new user */ }
    }
    if (contextParam) {
      try { setContext(JSON.parse(atob(contextParam))); } catch { /* ignore */ }
    }
    const manifestParam = params.get('manifest');
    if (manifestParam) {
      try { setManifest(JSON.parse(atob(manifestParam))); } catch { /* ignore */ }
    }
  }, []);

  const handleComplete = useCallback(
    (response: PopupResponse) => {
      // Redirect back to the dapp origin with the result in the URL fragment.
      // This is the OAuth callback pattern — works regardless of COOP/COEP
      // because the popup navigates to the dapp's origin (same-origin with SDK).
      // The SDK reads the fragment and closes the popup.
      const encoded = btoa(JSON.stringify(response));
      window.location.href = `${callbackOrigin}/__wallet_callback.html#${encoded}`;
    },
    [callbackOrigin],
  );

  const handleCancel = useCallback(() => {
    const encoded = btoa(JSON.stringify({ type: 'tx-cancelled' }));
    window.location.href = `${callbackOrigin}/__wallet_callback.html#${encoded}`;
  }, [callbackOrigin]);

  if (!flow) {
    return (
      <div style={styles.loadingShell} data-testid="popup-loading">
        <span style={styles.loadingSpinner} role="status" aria-label="Loading wallet" />
        <p style={styles.loadingText}>Loading wallet...</p>
      </div>
    );
  }

  switch (flow) {
    case 'connect':
      return (
        <ConnectFlow
          rpId={rpId}
          manifest={manifest}
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
    case 'runtime-prompt':
      return (
        <RuntimePrompt
          summary={context as RuntimePromptSummary}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
  }
}
