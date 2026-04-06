import { describe, it, expect } from 'vitest';
import { buildCreateOptions, buildGetOptions } from '../passkey';
import { DEFAULT_RP_ID, RP_NAME } from '../constants';

describe('passkey config builders', () => {
  it('buildCreateOptions uses default RP ID when none provided', async () => {
    const options = await buildCreateOptions();
    expect(options.publicKey!.rp.id).toBe(DEFAULT_RP_ID);
    expect(options.publicKey!.rp.name).toBe(RP_NAME);
    expect(options.publicKey!.pubKeyCredParams).toEqual([
      { alg: -7, type: 'public-key' },
    ]);
    expect(options.publicKey!.authenticatorSelection).toEqual({
      residentKey: 'required',
      userVerification: 'preferred',
    });
    expect((options.publicKey!.extensions as any)).toEqual({ prf: {} });
    expect(options.publicKey!.challenge).toBeInstanceOf(Uint8Array);
  });

  it('buildCreateOptions uses custom RP ID when provided', async () => {
    const options = await buildCreateOptions('localhost');
    expect(options.publicKey!.rp.id).toBe('localhost');
  });

  it('buildCreateOptions generates deterministic userId from account index', async () => {
    const a = await buildCreateOptions();
    const b = await buildCreateOptions();
    const aId = new Uint8Array(a.publicKey!.user.id as ArrayBuffer);
    const bId = new Uint8Array(b.publicKey!.user.id as ArrayBuffer);
    expect(aId).toEqual(bId);
    expect(aId.length).toBe(32);
  });

  it('buildGetOptions includes PRF eval with correct salt', () => {
    const credentialId = new Uint8Array([1, 2, 3, 4]);
    const options = buildGetOptions(credentialId);
    expect(options.publicKey!.allowCredentials).toHaveLength(1);
    expect(options.publicKey!.userVerification).toBe('preferred');
    const prfExt = (options.publicKey!.extensions as any).prf;
    expect(prfExt.eval.first).toBeInstanceOf(Uint8Array);
  });

  it('buildGetOptions uses custom RP ID when provided', () => {
    const options = buildGetOptions(new Uint8Array([1]), 'localhost');
    expect(options.publicKey!.rpId).toBe('localhost');
  });
});
