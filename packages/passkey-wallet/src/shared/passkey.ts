import {
  DEFAULT_RP_ID,
  RP_NAME,
  PRF_SALT,
  ACCOUNT_INDEX,
  USER_ID_SALT_PREFIX,
} from './constants';

const encoder = new TextEncoder();

/**
 * Builds the options object for navigator.credentials.create().
 * Creates a discoverable passkey with PRF extension support.
 */
export async function buildCreateOptions(rpId?: string): Promise<CredentialCreationOptions> {
  const prfSalt = `${USER_ID_SALT_PREFIX}${ACCOUNT_INDEX}`;
  const userId = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(prfSalt)),
  );

  return {
    publicKey: {
      rp: { id: rpId ?? DEFAULT_RP_ID, name: RP_NAME },
      user: { id: userId, name: 'user', displayName: 'Aztec User' },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
      extensions: {
        prf: {
          // Request PRF evaluation during creation.
          // Some authenticators support this (returns results.first),
          // others only report prf.enabled. We handle both cases.
          eval: { first: encoder.encode(PRF_SALT) },
        },
      } as any,
    },
  };
}

/**
 * Builds the options object for navigator.credentials.get().
 * Triggers PRF evaluation to derive the master key material.
 *
 * TIER-2-UPGRADE: Add optional `challenge` parameter. When present,
 * credentials.get() becomes the signing ceremony.
 */
export function buildGetOptions(
  credentialId?: Uint8Array,
  rpId?: string,
): CredentialRequestOptions {
  return {
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId ?? DEFAULT_RP_ID,
      // If credentialId is provided, target that specific credential (fastest).
      // If not, omit allowCredentials to trigger the discoverable credential
      // picker — the authenticator shows all passkeys for this RP ID.
      // This handles the "localStorage cleared" case: the user picks their
      // existing passkey → same CredRandom → same PRF → same address.
      ...(credentialId
        ? {
            allowCredentials: [{ id: credentialId, type: 'public-key' as const }],
          }
        : {}),
      userVerification: 'preferred',
      extensions: {
        prf: {
          eval: { first: encoder.encode(PRF_SALT) },
        },
      } as any,
    },
  };
}

/**
 * Extracts PRF output from a WebAuthn assertion response.
 * @returns 32-byte PRF output, or null if PRF is not supported.
 */
export function extractPRFOutput(
  credential: PublicKeyCredential,
): Uint8Array | null {
  const extensions = credential.getClientExtensionResults() as any;
  const prfResult = extensions?.prf?.results?.first;
  if (!prfResult) return null;
  return new Uint8Array(prfResult);
}

/**
 * Extracts the uncompressed P-256 public key from a credentials.create() response.
 * @returns The raw public key bytes from the attestation response.
 */
export function extractPublicKey(
  credential: PublicKeyCredential,
): Uint8Array {
  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  if (!publicKey) throw new Error('No public key in attestation response');
  return new Uint8Array(publicKey);
}
