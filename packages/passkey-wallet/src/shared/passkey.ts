import {
  RP_ID,
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
export async function buildCreateOptions(): Promise<CredentialCreationOptions> {
  const prfSalt = `${USER_ID_SALT_PREFIX}${ACCOUNT_INDEX}`;
  const userId = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(prfSalt)),
  );

  return {
    publicKey: {
      rp: { id: RP_ID, name: RP_NAME },
      user: { id: userId, name: 'user', displayName: 'Aztec User' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
      extensions: { prf: {} } as any,
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
  credentialId: Uint8Array,
): CredentialRequestOptions {
  return {
    publicKey: {
      allowCredentials: [
        {
          id: credentialId,
          type: 'public-key',
        },
      ],
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
