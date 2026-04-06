/**
 * Crypto Integration Tests
 *
 * Deep behavioral tests covering cross-derivation independence, boundary inputs,
 * output range validation (Fr/P-256 moduli), key properties, and 48-byte
 * HKDF-then-reduce correctness.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveMasterSecret,
  deriveSigningKey,
  deriveEncryptionKey,
  deriveAccountSalt,
  deriveAllKeys,
} from '../crypto';

// ---------------------------------------------------------------------------
// Constants from crypto spec
// ---------------------------------------------------------------------------

/** BN254 Fr modulus (Bn254 scalar field). */
const BN254_FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** P-256 curve order. */
const P256_ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

// ---------------------------------------------------------------------------
// Fixture PRF outputs
// ---------------------------------------------------------------------------

const ZEROS_32 = new Uint8Array(32).fill(0x00);
const ONES_32 = new Uint8Array(32).fill(0xff);
const AB_32 = new Uint8Array(32).fill(0xab);
const CD_32 = new Uint8Array(32).fill(0xcd);
const SINGLE_BIT_A = new Uint8Array(32).fill(0x00);
const SINGLE_BIT_B = new Uint8Array(32).fill(0x00);
// Flip one bit in SINGLE_BIT_B
SINGLE_BIT_B[15] = 0x01;

// ---------------------------------------------------------------------------
// Cross-derivation independence
// ---------------------------------------------------------------------------

describe('crypto — cross-derivation independence', () => {
  it('masterSecret and accountSalt differ even with the same PRF input', async () => {
    const master = await deriveMasterSecret(AB_32);
    const salt = await deriveAccountSalt(AB_32);
    expect(master).not.toBe(salt);
  });

  it('masterSecret and signingKey use different HKDF info → independent outputs', async () => {
    const master = await deriveMasterSecret(AB_32);
    const signing = await deriveSigningKey(AB_32);
    // signing key is bytes; compare its bigint value
    const signingBigInt = BigInt('0x' + Buffer.from(signing).toString('hex'));
    expect(master).not.toBe(signingBigInt);
  });

  it('changing HKDF info domain produces different masterSecret values', async () => {
    // All four derivations from the same PRF must produce distinct values
    const { masterSecret, accountSalt, signingKey } = await deriveAllKeys(AB_32);
    const signingBigInt = BigInt('0x' + Buffer.from(signingKey).toString('hex'));

    const values = [masterSecret, accountSalt, signingBigInt];
    const unique = new Set(values.map(String));
    // Should all be different (extremely high probability)
    expect(unique.size).toBe(values.length);
  });

  it('all four derived values are pairwise independent across different PRF inputs', async () => {
    const keysA = await deriveAllKeys(AB_32);
    const keysB = await deriveAllKeys(CD_32);

    expect(keysA.masterSecret).not.toBe(keysB.masterSecret);
    expect(keysA.accountSalt).not.toBe(keysB.accountSalt);
    expect(Buffer.from(keysA.signingKey).toString('hex')).not.toBe(
      Buffer.from(keysB.signingKey).toString('hex')
    );
  });
});

// ---------------------------------------------------------------------------
// Boundary inputs
// ---------------------------------------------------------------------------

describe('crypto — boundary inputs', () => {
  it('all-zeros PRF produces a non-zero masterSecret', async () => {
    const result = await deriveMasterSecret(ZEROS_32);
    expect(result).toBeGreaterThan(0n);
  });

  it('all-ones PRF produces a valid masterSecret', async () => {
    const result = await deriveMasterSecret(ONES_32);
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
    expect(result).toBeLessThan(BN254_FR_MODULUS);
  });

  it('all-zeros and all-ones PRF produce different masterSecrets', async () => {
    const fromZeros = await deriveMasterSecret(ZEROS_32);
    const fromOnes = await deriveMasterSecret(ONES_32);
    expect(fromZeros).not.toBe(fromOnes);
  });

  it('single-bit-different PRF inputs produce different masterSecrets', async () => {
    const a = await deriveMasterSecret(SINGLE_BIT_A);
    const b = await deriveMasterSecret(SINGLE_BIT_B);
    expect(a).not.toBe(b);
  });

  it('single-bit-different PRF inputs produce different accountSalts', async () => {
    const a = await deriveAccountSalt(SINGLE_BIT_A);
    const b = await deriveAccountSalt(SINGLE_BIT_B);
    expect(a).not.toBe(b);
  });

  it('single-bit-different PRF inputs produce different signingKeys', async () => {
    const a = await deriveSigningKey(SINGLE_BIT_A);
    const b = await deriveSigningKey(SINGLE_BIT_B);
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });
});

// ---------------------------------------------------------------------------
// Output range validation
// ---------------------------------------------------------------------------

describe('crypto — output range validation', () => {
  it('masterSecret is within Fr field (< BN254_FR_MODULUS)', async () => {
    for (const prf of [ZEROS_32, ONES_32, AB_32, CD_32]) {
      const result = await deriveMasterSecret(prf);
      expect(result).toBeLessThan(BN254_FR_MODULUS);
      expect(result).toBeGreaterThanOrEqual(0n);
    }
  });

  it('accountSalt is within Fr field (< BN254_FR_MODULUS)', async () => {
    for (const prf of [ZEROS_32, ONES_32, AB_32, CD_32]) {
      const result = await deriveAccountSalt(prf);
      expect(result).toBeLessThan(BN254_FR_MODULUS);
      expect(result).toBeGreaterThanOrEqual(0n);
    }
  });

  it('signingKey as bigint is < P256_ORDER and > 0', async () => {
    for (const prf of [ZEROS_32, ONES_32, AB_32, CD_32]) {
      const key = await deriveSigningKey(prf);
      const keyBigInt = BigInt('0x' + Buffer.from(key).toString('hex'));
      expect(keyBigInt).toBeGreaterThan(0n);
      expect(keyBigInt).toBeLessThan(P256_ORDER);
    }
  });

  it('signingKey is exactly 32 bytes for all boundary inputs', async () => {
    for (const prf of [ZEROS_32, ONES_32, AB_32, CD_32]) {
      const key = await deriveSigningKey(prf);
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    }
  });
});

// ---------------------------------------------------------------------------
// Encryption key properties
// ---------------------------------------------------------------------------

describe('crypto — encryption key properties', () => {
  it('encryption key algorithm is AES-GCM', async () => {
    const key = await deriveEncryptionKey(AB_32);
    expect((key.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM');
  });

  it('encryption key length is 256 bits', async () => {
    const key = await deriveEncryptionKey(AB_32);
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
  });

  it('encryption key is non-extractable', async () => {
    const key = await deriveEncryptionKey(AB_32);
    expect(key.extractable).toBe(false);

    // Attempting to export should throw
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('encryption key has only encrypt and decrypt usages', async () => {
    const key = await deriveEncryptionKey(AB_32);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
    expect(key.usages).toHaveLength(2);
  });

  it('same PRF input produces functionally equivalent encryption keys', async () => {
    const k1 = await deriveEncryptionKey(AB_32);
    const k2 = await deriveEncryptionKey(AB_32);

    // Can't compare keys directly since non-extractable,
    // but we can verify they produce the same ciphertext when used with the same IV
    const plaintext = new TextEncoder().encode('test data');
    const iv = new Uint8Array(12).fill(0x42);

    const ct1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, plaintext);
    const ct2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k2, plaintext);

    expect(Buffer.from(ct1).toString('hex')).toBe(Buffer.from(ct2).toString('hex'));
  });
});

// ---------------------------------------------------------------------------
// Determinism across many calls
// ---------------------------------------------------------------------------

describe('crypto — determinism', () => {
  it('100 calls with same PRF produce same masterSecret', async () => {
    const first = await deriveMasterSecret(AB_32);
    for (let i = 0; i < 99; i++) {
      const result = await deriveMasterSecret(AB_32);
      expect(result).toBe(first);
    }
  });

  it('100 calls with same PRF produce same accountSalt', async () => {
    const first = await deriveAccountSalt(AB_32);
    for (let i = 0; i < 99; i++) {
      const result = await deriveAccountSalt(AB_32);
      expect(result).toBe(first);
    }
  });

  it('100 calls with same PRF produce same signingKey bytes', async () => {
    const first = Buffer.from(await deriveSigningKey(AB_32)).toString('hex');
    for (let i = 0; i < 99; i++) {
      const result = Buffer.from(await deriveSigningKey(AB_32)).toString('hex');
      expect(result).toBe(first);
    }
  });

  it('deriveAllKeys is fully deterministic across multiple calls', async () => {
    const a = await deriveAllKeys(AB_32);
    const b = await deriveAllKeys(AB_32);
    const c = await deriveAllKeys(AB_32);

    expect(a.masterSecret).toBe(b.masterSecret);
    expect(b.masterSecret).toBe(c.masterSecret);
    expect(a.accountSalt).toBe(b.accountSalt);
    expect(b.accountSalt).toBe(c.accountSalt);
    expect(Buffer.from(a.signingKey).toString('hex')).toBe(
      Buffer.from(b.signingKey).toString('hex')
    );
  });
});

// ---------------------------------------------------------------------------
// 48-byte derivation correctness (HKDF output length before Fr reduction)
// ---------------------------------------------------------------------------

describe('crypto — 48-byte derivation and Fr reduction', () => {
  it('masterSecret is strictly less than BN254_FR_MODULUS (reduction applied)', async () => {
    // HKDF outputs 48 bytes (384 bits), which is much larger than Fr (254 bits).
    // After reduction, the result must be in [0, Fr_modulus).
    const result = await deriveMasterSecret(AB_32);
    expect(result).toBeLessThan(BN254_FR_MODULUS);
  });

  it('accountSalt is strictly less than BN254_FR_MODULUS (reduction applied)', async () => {
    const result = await deriveAccountSalt(AB_32);
    expect(result).toBeLessThan(BN254_FR_MODULUS);
  });

  it('masterSecret from all-ones PRF is still in Fr field (reduction handles overflow)', async () => {
    // all-ones gives maximum HKDF output, testing that reduction works at the upper extreme
    const result = await deriveMasterSecret(ONES_32);
    expect(result).toBeLessThan(BN254_FR_MODULUS);
    expect(result).toBeGreaterThanOrEqual(0n);
  });

  it('signingKey reduction stays within P-256 order (RFC 9380 method)', async () => {
    // 48 bytes → reduce mod P256_ORDER → 32-byte result
    // Verify signingKey < P256_ORDER for all test inputs
    for (const prf of [ZEROS_32, ONES_32, AB_32, CD_32, SINGLE_BIT_A, SINGLE_BIT_B]) {
      const key = await deriveSigningKey(prf);
      const keyBigInt = BigInt('0x' + Buffer.from(key).toString('hex'));
      expect(keyBigInt).toBeLessThan(P256_ORDER);
    }
  });
});

// ---------------------------------------------------------------------------
// deriveAllKeys convenience
// ---------------------------------------------------------------------------

describe('crypto — deriveAllKeys', () => {
  it('returns all four keys in one call', async () => {
    const result = await deriveAllKeys(AB_32);
    expect(typeof result.masterSecret).toBe('bigint');
    expect(result.signingKey).toBeInstanceOf(Uint8Array);
    expect(result.encryptionKey).toBeInstanceOf(CryptoKey);
    expect(typeof result.accountSalt).toBe('bigint');
  });

  it('parallel derivation matches sequential derivation', async () => {
    const all = await deriveAllKeys(AB_32);
    const master = await deriveMasterSecret(AB_32);
    const salt = await deriveAccountSalt(AB_32);
    const signing = await deriveSigningKey(AB_32);

    expect(all.masterSecret).toBe(master);
    expect(all.accountSalt).toBe(salt);
    expect(Buffer.from(all.signingKey).toString('hex')).toBe(
      Buffer.from(signing).toString('hex')
    );
  });
});
