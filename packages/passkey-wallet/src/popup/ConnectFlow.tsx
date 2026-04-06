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
import type { PopupResponse } from '../shared/types';
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
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function ConnectFlow({ credentialId, onComplete, onCancel }: ConnectFlowProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
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
        const options = buildGetOptions(new Uint8Array(credentialId!));
        credential = (await navigator.credentials.get(options)) as PublicKeyCredential;
        prfOutput = extractPRFOutput(credential);
        publicKey = new Uint8Array(0); // Host has it in CredentialStore
      } else {
        const options = await buildCreateOptions();
        credential = (await navigator.credentials.create(options)) as PublicKeyCredential;
        prfOutput = extractPRFOutput(credential);
        publicKey = extractPublicKey(credential);
      }

      if (!prfOutput) throw new Error('PRF extension not supported by this authenticator');

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
        publicKey: publicKey.buffer,
        credentialId: credential.rawId,
        masterSecret: `0x${keys.masterSecret.toString(16)}`,
        // TIER-2-UPGRADE: Remove signingKey from this response.
        signingKey: keys.signingKey.buffer,
        encryptionKey: encKeyBytes.buffer,
        accountSalt: `0x${keys.accountSalt.toString(16)}`,
      });
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.headerRow}>
          <div className={styles.logoWrap} aria-hidden="true">
            <span className={styles.logoText}>A</span>
          </div>
          <span className={styles.wordmark}>Aztec Wallet</span>
        </div>

        {/* Biometric illustration */}
        <div className={styles.illustrationWrap}>
          <div className={styles.ringOuter}>
            {isAuthenticating && (
              <span className={styles.ringPulse} aria-hidden="true" />
            )}
            <div className={styles.iconWrap} aria-hidden="true">
              <Fingerprint size={32} strokeWidth={1.5} />
            </div>
          </div>
          <h1 className={styles.illustrationTitle}>
            {isReturningUser ? 'Unlock Your Wallet' : 'Create Your Wallet'}
          </h1>
          <p className={styles.illustrationDesc}>
            {isReturningUser
              ? 'Authenticate with your passkey to restore your wallet.'
              : 'Create a passkey to secure your Aztec wallet. Your biometric stays on your device.'}
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className={styles.errorWrap} role="alert" data-testid="connect-error">
            <AlertTriangle size={14} strokeWidth={2} className={styles.errorIcon} />
            <p className={styles.errorMessage}>{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className={styles.section}>
          <button
            type="button"
            onClick={handleAuth}
            disabled={isAuthenticating}
            className={styles.primaryButton}
            data-testid="connect-passkey-button"
          >
            {isAuthenticating ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span>Authenticating…</span>
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
            className={styles.ghostButton}
            data-testid="connect-cancel-button"
          >
            Cancel
          </button>
        </div>

        {/* Trust badge */}
        <div className={styles.trustWrap} aria-label="Secured by WebAuthn">
          <ShieldCheck size={12} strokeWidth={2} className={styles.trustIcon} aria-hidden="true" />
          <span className={styles.trustText}>Secured by WebAuthn</span>
        </div>

      </div>
    </div>
  );
}
