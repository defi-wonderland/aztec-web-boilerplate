import { useEffect, useRef, useState, useCallback } from 'react';
import { SecureChannel } from '../shared/SecureChannel';
import { PXEManager } from './PXEManager';
import { CredentialStore } from './CredentialStore';
import { RPCHandler } from './RPCHandler';
import { PermissionReview } from '../popup/PermissionReview';
import { ConnectFlow } from '../popup/ConnectFlow';
import { popupGlobalCSS } from '../popup/styles';
import type { PopupResponse } from '../shared/types';

interface ManifestData {
  metadata: { name: string; url?: string };
  capabilities: unknown[];
}

type IframePhase = 'idle' | 'reviewing' | 'authenticating';

/**
 * Root component for the wallet host iframe.
 * Handles the full connect ceremony inside the iframe (no popup needed):
 *   1. Permission review (if manifest provided)
 *   2. Biometric authentication (WebAuthn/PRF)
 *   3. Sends auth-keys back to SDK via postMessage
 * Also handles RPC routing to PXE Worker via SecureChannel.
 */
export function WalletHost() {
  const channelRef = useRef<SecureChannel | null>(null);
  const [phase, setPhase] = useState<IframePhase>('idle');
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [rpId, setRpId] = useState<string | undefined>();

  const handlePermissionApprove = useCallback(() => {
    // Move to biometric step
    setPhase('authenticating');
  }, []);

  const handlePermissionReject = useCallback(() => {
    window.parent.postMessage({ type: 'CONNECT_REJECTED' }, '*');
    setManifest(null);
    setPhase('idle');
  }, []);

  const handleAuthComplete = useCallback((response: PopupResponse) => {
    // Send auth-keys back to SDK
    window.parent.postMessage({ type: 'CONNECT_AUTH_RESULT', response }, '*');
    setManifest(null);
    setPhase('idle');
  }, []);

  const handleAuthCancel = useCallback(() => {
    window.parent.postMessage({ type: 'CONNECT_REJECTED' }, '*');
    setManifest(null);
    setPhase('idle');
  }, []);

  // Report content height to parent so iframe can resize dynamically
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: 'IFRAME_RESIZE', height }, '*');
    });
    observer.observe(contentRef.current);
    // Also fire once on mount
    window.parent.postMessage({ type: 'IFRAME_RESIZE', height: document.documentElement.scrollHeight }, '*');
    return () => observer.disconnect();
  }, [phase, manifest]);

  useEffect(() => {
    // Inject global CSS for the popup-style UI
    const styleEl = document.createElement('style');
    styleEl.textContent = popupGlobalCSS;
    document.head.appendChild(styleEl);

    const pxeManager = new PXEManager();
    const credentialStore = new CredentialStore();

    const onMessage = async (event: MessageEvent) => {
      // Handle connect ceremony request
      if (event.data?.type === 'START_CONNECT') {
        const { manifest: m, rpId: rp } = event.data;
        setRpId(rp);
        if (m) {
          setManifest(m);
          setPhase('reviewing');
        } else {
          // No manifest — skip straight to biometric
          setPhase('authenticating');
        }
        return;
      }

      if (event.data?.type !== 'INIT') return;
      const port = event.ports[0];
      if (!port) return;
      if (channelRef.current) return;

      const channel = new SecureChannel('i2p');
      await channel.initFromPort(port);
      channelRef.current = channel;

      const contractConfigs = event.data.contracts ?? [];
      const nodeUrl = event.data.nodeUrl ?? 'http://localhost:8080';
      const handler = new RPCHandler(pxeManager, credentialStore, contractConfigs, nodeUrl);
      handler.register(channel);
    };

    window.addEventListener('message', onMessage);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'WALLET_HOST_READY' }, '*');
    }

    return () => {
      window.removeEventListener('message', onMessage);
      channelRef.current?.destroy();
      pxeManager.destroy();
      document.head.removeChild(styleEl);
    };
  }, []);

  // Phase 1: Permission review
  if (phase === 'reviewing' && manifest) {
    return (
      <div ref={contentRef}>
        <PermissionReview
          manifest={manifest}
          onApprove={handlePermissionApprove}
          onReject={handlePermissionReject}
        />
      </div>
    );
  }

  // Phase 2: Biometric authentication
  if (phase === 'authenticating') {
    return (
      <div ref={contentRef}>
        <ConnectFlow
          rpId={rpId}
          onComplete={handleAuthComplete}
          onCancel={handleAuthCancel}
        />
      </div>
    );
  }

  return <div ref={contentRef} />;
}
