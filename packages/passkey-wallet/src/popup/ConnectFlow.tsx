import { useState } from 'react';
import { buildCreateOptions, buildGetOptions, extractPRFOutput, extractPublicKey } from '../shared/passkey';
import { deriveAllKeys } from '../shared/crypto';
import { HKDF_INFO_ENCRYPTION_KEY } from '../shared/constants';
import type { PopupResponse } from '../shared/types';

interface ConnectFlowProps {
  credentialId?: ArrayBuffer;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

export function ConnectFlow({ credentialId, onComplete, onCancel }: ConnectFlowProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const isReturningUser = !!credentialId;

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

      // Derive raw encryption key bytes (not the CryptoKey - host imports it)
      const { hkdf } = await import('@noble/hashes/hkdf');
      const { sha256 } = await import('@noble/hashes/sha256');
      const encKeyBytes = hkdf(sha256, prfOutput, undefined,
        new TextEncoder().encode(HKDF_INFO_ENCRYPTION_KEY), 32);

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
    } catch (err: any) {
      setStatus('error');
      setError(err.message ?? 'Authentication failed');
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 360 }}>
      <h2>{isReturningUser ? 'Unlock Your Wallet' : 'Create Your Aztec Wallet'}</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        {isReturningUser
          ? 'Authenticate with your passkey to restore your wallet.'
          : 'Create a passkey to secure your Aztec wallet.'}
      </p>
      {error && <div style={{ color: 'red', marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <button onClick={handleAuth} disabled={status === 'authenticating'}
        style={{ width: '100%', padding: '12px 24px', fontSize: 16, cursor: status === 'authenticating' ? 'not-allowed' : 'pointer' }}>
        {status === 'authenticating' ? 'Authenticating...' : isReturningUser ? 'Unlock with Passkey' : 'Create Passkey'}
      </button>
      <button onClick={onCancel}
        style={{ width: '100%', padding: '8px 24px', marginTop: 8, background: 'none', border: '1px solid #ccc' }}>
        Cancel
      </button>
    </div>
  );
}
