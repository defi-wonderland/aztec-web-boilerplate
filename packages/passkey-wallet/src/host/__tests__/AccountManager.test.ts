import { describe, it, expect } from 'vitest';
import { createSigningKeyBuffer } from '../AccountManager';

describe('AccountManager', () => {
  it('createSigningKeyBuffer converts Uint8Array to Buffer', () => {
    const key = new Uint8Array(32).fill(0x42);
    const buf = createSigningKeyBuffer(key);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(32);
    expect(buf[0]).toBe(0x42);
  });
});
