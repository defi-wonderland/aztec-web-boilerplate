import { useEffect, useRef, useState, useCallback } from 'react';
import { SecureChannel } from '../shared/SecureChannel';
import { PXEManager } from './PXEManager';
import { CredentialStore } from './CredentialStore';
import { RPCHandler } from './RPCHandler';
import { PermissionReview } from '../popup/PermissionReview';
import { popupGlobalCSS } from '../popup/styles';

interface ManifestData {
  metadata: { name: string; url?: string };
  capabilities: unknown[];
}

/**
 * Root component for the wallet host iframe.
 * - Initially invisible (display:none on iframe element)
 * - When SDK sends REVIEW_CAPABILITIES, SDK makes iframe visible as modal
 * - WalletHost renders PermissionReview for user approval
 * - After approval, signals SDK via postMessage, iframe goes back to invisible
 * - Also handles RPC routing to PXE Worker via SecureChannel
 */
export function WalletHost() {
  const channelRef = useRef<SecureChannel | null>(null);
  const [manifest, setManifest] = useState<ManifestData | null>(null);

  const handleApprove = useCallback(() => {
    window.parent.postMessage({ type: 'CAPABILITIES_APPROVED' }, '*');
    setManifest(null);
  }, []);

  const handleReject = useCallback(() => {
    window.parent.postMessage({ type: 'CAPABILITIES_REJECTED' }, '*');
    setManifest(null);
  }, []);

  useEffect(() => {
    // Inject global CSS for the PermissionReview UI (same styles as popup)
    const styleEl = document.createElement('style');
    styleEl.textContent = popupGlobalCSS;
    document.head.appendChild(styleEl);

    const pxeManager = new PXEManager();
    const credentialStore = new CredentialStore();

    const onMessage = async (event: MessageEvent) => {
      // Handle capability review request (plain postMessage, not SecureChannel)
      if (event.data?.type === 'REVIEW_CAPABILITIES') {
        setManifest(event.data.manifest);
        return;
      }

      if (event.data?.type !== 'INIT') return;
      const port = event.ports[0];
      if (!port) return;
      // Only process INIT once
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

    // Signal to the parent SDK that we're ready to receive INIT
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

  // If we have a manifest to review, render the PermissionReview UI
  if (manifest) {
    return (
      <PermissionReview
        manifest={manifest}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );
  }

  return null;
}
