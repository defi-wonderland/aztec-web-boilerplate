import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { Fr } from '@aztec/foundation/curves/bn254';
import {
  HKDF_INFO_MASTER_SECRET,
  HKDF_INFO_SIGNING_KEY,
  HKDF_INFO_ENCRYPTION_KEY,
  HKDF_INFO_ACCOUNT_SALT,
} from './constants';

const encoder = new TextEncoder();

/**
 * Derives the master secret for Aztec protocol keys (viewing, nullifier, tagging, outgoing).
 * 48 bytes via HKDF then reduced mod Fr to eliminate bias (per RFC 9380).
 */
export async function deriveMasterSecret(prfOutput: Uint8Array): Promise<bigint> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_MASTER_SECRET), 48);
  return Fr.fromBufferReduce(Buffer.from(bytes)).toBigInt();
}

/**
 * Derives the P-256 signing key from PRF output.
 * Returns raw 32-byte private key for use with @noble/curves/p256.
 *
 * TIER-2-UPGRADE: Remove this function entirely. Tier 2 uses hardware-bound
 * WebAuthn signing — the signing key never enters JavaScript.
 */
export async function deriveSigningKey(prfOutput: Uint8Array): Promise<Uint8Array> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_SIGNING_KEY), 48);
  const P256_ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
  const num = bytesToBigInt(bytes) % P256_ORDER;
  return bigIntToBytes(num, 32);
}

/**
 * Derives a non-extractable AES-256-GCM CryptoKey for encrypting/decrypting IndexedDB at rest.
 */
export async function deriveEncryptionKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_ENCRYPTION_KEY), 32);
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Derives the account salt for deterministic address computation.
 * 48 bytes via HKDF then reduced mod Fr.
 */
export async function deriveAccountSalt(prfOutput: Uint8Array): Promise<bigint> {
  const bytes = hkdf(sha256, prfOutput, undefined, encoder.encode(HKDF_INFO_ACCOUNT_SALT), 48);
  return Fr.fromBufferReduce(Buffer.from(bytes)).toBigInt();
}

/** Convenience: derive all keys at once from a single PRF output. */
export async function deriveAllKeys(prfOutput: Uint8Array) {
  const [masterSecret, signingKey, encryptionKey, accountSalt] = await Promise.all([
    deriveMasterSecret(prfOutput),
    deriveSigningKey(prfOutput),
    deriveEncryptionKey(prfOutput),
    deriveAccountSalt(prfOutput),
  ]);
  return { masterSecret, signingKey, encryptionKey, accountSalt };
}

/** Big-endian bytes to bigint. */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/** Bigint to fixed-length big-endian bytes. */
function bigIntToBytes(num: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(num & 0xffn);
    num >>= 8n;
  }
  return bytes;
}
