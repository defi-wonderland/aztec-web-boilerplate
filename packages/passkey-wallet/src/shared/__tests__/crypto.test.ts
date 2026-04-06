import { describe, it, expect } from 'vitest';
import {
  deriveMasterSecret,
  deriveSigningKey,
  deriveEncryptionKey,
  deriveAccountSalt,
  deriveAllKeys,
} from '../crypto';

const TEST_PRF = new Uint8Array(32).fill(0xab);

describe('crypto key derivation', () => {
  it('deriveMasterSecret returns a bigint from 48-byte HKDF output', async () => {
    const result = await deriveMasterSecret(TEST_PRF);
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
  });

  // TIER-2-UPGRADE: Remove this test. Tier 2 has no JS signing key.
  it('deriveSigningKey returns a 32-byte Uint8Array', async () => {
    const result = await deriveSigningKey(TEST_PRF);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  it('deriveEncryptionKey returns a non-extractable CryptoKey', async () => {
    const key = await deriveEncryptionKey(TEST_PRF);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('deriveAccountSalt returns a bigint from 48-byte HKDF output', async () => {
    const result = await deriveAccountSalt(TEST_PRF);
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
  });

  it('same PRF input always produces same keys (deterministic)', async () => {
    const a = await deriveAllKeys(TEST_PRF);
    const b = await deriveAllKeys(TEST_PRF);
    expect(a.masterSecret).toBe(b.masterSecret);
    expect(a.accountSalt).toBe(b.accountSalt);
    expect(Buffer.from(a.signingKey).toString('hex')).toBe(
      Buffer.from(b.signingKey).toString('hex'),
    );
  });

  it('different PRF inputs produce different keys', async () => {
    const other = new Uint8Array(32).fill(0xcd);
    const a = await deriveAllKeys(TEST_PRF);
    const b = await deriveAllKeys(other);
    expect(a.masterSecret).not.toBe(b.masterSecret);
    expect(a.accountSalt).not.toBe(b.accountSalt);
  });
});
