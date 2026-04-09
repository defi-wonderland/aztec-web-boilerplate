import { useState } from 'react';
import { Fingerprint, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  buildCreateOptions,
  buildGetOptions,
  extractPRFOutput,
  extractPublicKey,
} from '../shared/passkey';
import { deriveAllKeys } from '../shared/crypto';
import { HKDF_INFO_ENCRYPTION_KEY } from '../shared/constants';
import { toBase64 } from '../shared/encoding';
import type { PopupResponse } from '../shared/types';
import { PermissionReview } from './PermissionReview';
import {
  layoutStyles,
  headerStyles,
  illustrationStyles,
  buttonStyles,
  errorStyles,
  trustBadgeStyles,
} from './styles';

/* ---------------------------------------------------------------------------
   Styles
   --------------------------------------------------------------------------- */

const styles = {
  // Layout
  shell: layoutStyles.shell,
  card: layoutStyles.card,
  section: layoutStyles.section,

  // Header
  headerRow: headerStyles.row,
  logoWrap: headerStyles.logoWrap,
  logoText: headerStyles.logoText,
  wordmark: headerStyles.wordmark,

  // Illustration
  illustrationWrap: illustrationStyles.wrap,
  ringOuter: illustrationStyles.ringOuter,
  ringPulse: illustrationStyles.ringPulse,
  iconWrap: illustrationStyles.iconWrap,
  illustrationTitle: illustrationStyles.title,
  illustrationDesc: illustrationStyles.description,

  // Error
  errorWrap: errorStyles.wrap,
  errorIcon: errorStyles.icon,
  errorMessage: errorStyles.message,

  // Buttons
  primaryButton: buttonStyles.primary,
  ghostButton: buttonStyles.ghost,
  spinner: buttonStyles.spinner,

  // Trust badge
  trustWrap: trustBadgeStyles.wrap,
  trustIcon: trustBadgeStyles.icon,
  trustText: trustBadgeStyles.text,
} as const;

/* ---------------------------------------------------------------------------
   Props
   --------------------------------------------------------------------------- */

interface ConnectFlowProps {
  credentialId?: ArrayBuffer;
  rpId?: string;
  manifest?: { metadata: { name: string; url?: string }; capabilities: unknown[] };
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function ConnectFlow({ credentialId, rpId, manifest, onComplete, onCancel }: ConnectFlowProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionsApproved, setPermissionsApproved] = useState(!manifest);
  const isReturningUser = !!credentialId;
  const isAuthenticating = status === 'authenticating';

  const handleAuth = async () => {
    setStatus('authenticating');
    setError(null);
    try {
      let credential: PublicKeyCredential;
      let prfOutput: Uint8Array | null;
      let publicKey: Uint8Array;

      if (isReturningUser) {
        // Returning user with known credential ID — fastest path
        const options = buildGetOptions(new Uint8Array(credentialId!), rpId);
        credential = (await navigator.credentials.get(options)) as PublicKeyCredential;
        prfOutput = extractPRFOutput(credential);
        publicKey = new Uint8Array(0);
      } else {
        // No stored credential ID. Try discoverable credential first —
        // if the user already has a passkey for this RP, the authenticator
        // will show it. Same passkey = same CredRandom = same PRF = same address.
        // This handles the "localStorage cleared" case without creating
        // a duplicate passkey.
        let usedExisting = false;
        try {
          const discoverOptions = buildGetOptions(undefined, rpId);
          credential = (await navigator.credentials.get(discoverOptions)) as PublicKeyCredential;
          prfOutput = extractPRFOutput(credential);
          publicKey = new Uint8Array(0);
          usedExisting = true;
        } catch {
          // No existing credential found — create a new passkey
          usedExisting = false;
        }

        if (!usedExisting) {
          const createOptions = await buildCreateOptions(rpId);
          credential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential;
          publicKey = extractPublicKey(credential);

          // Check if PRF came back from create
          prfOutput = extractPRFOutput(credential);

          if (!prfOutput) {
            const createExtensions = credential.getClientExtensionResults() as any;
            if (!createExtensions?.prf?.enabled) {
              throw new Error(
                'Your authenticator does not support the PRF extension required for key derivation. ' +
                'Please use a platform authenticator (Touch ID, Windows Hello) or a FIDO2 security key with PRF support.',
              );
            }

            // PRF supported but not evaluated during create — second get() call
            const newCredentialId = new Uint8Array(credential.rawId);
            const getOptions = buildGetOptions(newCredentialId, rpId);
            const authCredential = (await navigator.credentials.get(getOptions)) as PublicKeyCredential;
            prfOutput = extractPRFOutput(authCredential);
            credential = authCredential;
          }
        }
      }

      if (!prfOutput) {
        throw new Error(
          'Failed to derive PRF output from the authenticator. ' +
          'Please ensure you are using a PRF-capable authenticator.'
        );
      }

      const keys = await deriveAllKeys(prfOutput);

      // Derive raw encryption key bytes (not the CryptoKey — host imports it)
      const { hkdf } = await import('@noble/hashes/hkdf');
      const { sha256 } = await import('@noble/hashes/sha256');
      const encKeyBytes = hkdf(
        sha256,
        prfOutput,
        undefined,
        new TextEncoder().encode(HKDF_INFO_ENCRYPTION_KEY),
        32,
      );

      onComplete({
        type: 'auth-keys',
        publicKey: toBase64(publicKey),
        credentialId: toBase64(new Uint8Array(credential.rawId)),
        masterSecret: `0x${keys.masterSecret.toString(16)}`,
        // TIER-2-UPGRADE: Remove signingKey from this response.
        signingKey: toBase64(keys.signingKey),
        encryptionKey: toBase64(encKeyBytes),
        accountSalt: `0x${keys.accountSalt.toString(16)}`,
      });
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    }
  };

  // Show permission review first if manifest provided and not yet approved
  if (!permissionsApproved && manifest) {
    return (
      <PermissionReview
        manifest={manifest}
        onApprove={() => setPermissionsApproved(true)}
        onReject={onCancel}
      />
    );
  }

  return (
    <div style={styles.shell}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.headerRow}>
          <div style={styles.logoWrap} aria-hidden="true">
            <span style={styles.logoText}>A</span>
          </div>
          <span style={styles.wordmark}>Aztec Wallet</span>
        </div>

        {/* Biometric illustration */}
        <div style={styles.illustrationWrap}>
          <div style={styles.ringOuter}>
            {isAuthenticating && (
              <span style={styles.ringPulse} aria-hidden="true" />
            )}
            <div style={styles.iconWrap} aria-hidden="true">
              <Fingerprint size={32} strokeWidth={1.5} />
            </div>
          </div>
          <h1 style={styles.illustrationTitle}>
            {isReturningUser ? 'Unlock Your Wallet' : 'Create Your Wallet'}
          </h1>
          <p style={styles.illustrationDesc}>
            {isReturningUser
              ? 'Authenticate with your passkey to restore your wallet.'
              : 'Create a passkey to secure your Aztec wallet. Your biometric stays on your device.'}
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div style={styles.errorWrap} role="alert" data-testid="connect-error">
            <AlertTriangle size={14} strokeWidth={2} style={styles.errorIcon} />
            <p style={styles.errorMessage}>{error}</p>
          </div>
        )}

        {/* Actions */}
        <div style={styles.section}>
          <button
            type="button"
            onClick={handleAuth}
            disabled={isAuthenticating}
            style={{
              ...styles.primaryButton,
              ...(isAuthenticating ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
            data-testid="connect-passkey-button"
          >
            {isAuthenticating ? (
              <>
                <span style={styles.spinner} aria-hidden="true" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <Fingerprint size={16} strokeWidth={2} aria-hidden="true" />
                <span>{isReturningUser ? 'Unlock with Passkey' : 'Create Passkey'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            style={styles.ghostButton}
            data-testid="connect-cancel-button"
          >
            Cancel
          </button>
        </div>

        {/* Trust badge */}
        <div style={styles.trustWrap} aria-label="Secured by WebAuthn">
          <ShieldCheck size={12} strokeWidth={2} style={styles.trustIcon} aria-hidden="true" />
          <span style={styles.trustText}>Secured by WebAuthn</span>
        </div>

      </div>
    </div>
  );
}
