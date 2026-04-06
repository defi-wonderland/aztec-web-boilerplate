/**
 * CredentialStore Integration Tests
 *
 * Deep behavioral tests covering large credential IDs, full binary range
 * roundtrips, overwrite behavior, concurrent access patterns, and base64
 * encoding correctness.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialStore } from '../CredentialStore';

// ---------------------------------------------------------------------------
// Mock storage implementation
// ---------------------------------------------------------------------------

class MockStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  /** Test-only: check internal raw stored value. */
  getRaw(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  /** Test-only: count stored items. */
  size(): number {
    return this.data.size;
  }
}

// ---------------------------------------------------------------------------
// Large credential IDs
// ---------------------------------------------------------------------------

describe('CredentialStore — large credential IDs', () => {
  let store: CredentialStore;
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    store = new CredentialStore(storage);
  });

  it('stores and retrieves a 64-byte credential ID', () => {
    const credId = new Uint8Array(64).map((_, i) => i % 256);
    store.saveCredentialId(credId);
    const result = store.getCredentialId();
    expect(result).toEqual(credId);
  });

  it('stores and retrieves a 128-byte credential ID', () => {
    const credId = new Uint8Array(128).map((_, i) => (i * 7) % 256);
    store.saveCredentialId(credId);
    const result = store.getCredentialId();
    expect(result).toEqual(credId);
  });

  it('stores and retrieves a 256-byte credential ID', () => {
    const credId = new Uint8Array(256).map((_, i) => i % 256);
    store.saveCredentialId(credId);
    const result = store.getCredentialId();
    expect(result).toEqual(credId);
  });

  it('256-byte credential ID roundtrip preserves all bytes', () => {
    const credId = new Uint8Array(256);
    for (let i = 0; i < 256; i++) credId[i] = i; // all values 0-255
    store.saveCredentialId(credId);
    const result = store.getCredentialId()!;
    for (let i = 0; i < 256; i++) {
      expect(result[i]).toBe(i);
    }
  });

  it('stores and retrieves a 1-byte credential ID', () => {
    const credId = new Uint8Array([0xab]);
    store.saveCredentialId(credId);
    const result = store.getCredentialId();
    expect(result).toEqual(credId);
  });
});

// ---------------------------------------------------------------------------
// Binary data roundtrip (all byte values 0x00-0xFF)
// ---------------------------------------------------------------------------

describe('CredentialStore — binary data roundtrip', () => {
  let store: CredentialStore;

  beforeEach(() => {
    store = new CredentialStore(new MockStorage());
  });

  it('roundtrips all 256 possible byte values in credentialId', () => {
    const all256 = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all256[i] = i;

    store.saveCredentialId(all256);
    const result = store.getCredentialId()!;

    expect(result).toHaveLength(256);
    for (let i = 0; i < 256; i++) {
      expect(result[i]).toBe(i);
    }
  });

  it('roundtrips all 256 possible byte values in publicKey', () => {
    const all256 = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all256[i] = i;

    store.savePublicKey(all256);
    const result = store.getPublicKey()!;

    expect(result).toHaveLength(256);
    for (let i = 0; i < 256; i++) {
      expect(result[i]).toBe(i);
    }
  });

  it('all-zeros 32-byte credential ID roundtrips correctly', () => {
    const zeros = new Uint8Array(32).fill(0x00);
    store.saveCredentialId(zeros);
    const result = store.getCredentialId()!;
    expect(Array.from(result)).toEqual(Array.from(zeros));
  });

  it('all-ones 32-byte credential ID roundtrips correctly', () => {
    const ones = new Uint8Array(32).fill(0xff);
    store.saveCredentialId(ones);
    const result = store.getCredentialId()!;
    expect(Array.from(result)).toEqual(Array.from(ones));
  });

  it('alternating bytes roundtrip correctly', () => {
    const alternating = new Uint8Array(64).map((_, i) => i % 2 === 0 ? 0x00 : 0xff);
    store.saveCredentialId(alternating);
    const result = store.getCredentialId()!;
    expect(Array.from(result)).toEqual(Array.from(alternating));
  });

  it('random-ish bytes roundtrip correctly', () => {
    // Pseudo-random pattern using a simple LCG
    const bytes = new Uint8Array(100);
    let state = 12345;
    for (let i = 0; i < 100; i++) {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      bytes[i] = state & 0xff;
    }
    store.saveCredentialId(bytes);
    const result = store.getCredentialId()!;
    expect(Array.from(result)).toEqual(Array.from(bytes));
  });
});

// ---------------------------------------------------------------------------
// Overwrite behavior
// ---------------------------------------------------------------------------

describe('CredentialStore — overwrite behavior', () => {
  let store: CredentialStore;

  beforeEach(() => {
    store = new CredentialStore(new MockStorage());
  });

  it('second saveCredentialId overwrites first', () => {
    const first = new Uint8Array([0x01, 0x02, 0x03]);
    const second = new Uint8Array([0xaa, 0xbb, 0xcc]);

    store.saveCredentialId(first);
    store.saveCredentialId(second);

    const result = store.getCredentialId();
    expect(result).toEqual(second);
  });

  it('second savePublicKey overwrites first', () => {
    const first = new Uint8Array(65).fill(0x04);
    const second = new Uint8Array(33).fill(0x02);

    store.savePublicKey(first);
    store.savePublicKey(second);

    const result = store.getPublicKey();
    expect(result).toEqual(second);
  });

  it('overwrite preserves length correctly', () => {
    const long = new Uint8Array(200).fill(0xaa);
    const short = new Uint8Array(10).fill(0xbb);

    store.saveCredentialId(long);
    store.saveCredentialId(short);

    const result = store.getCredentialId()!;
    expect(result).toHaveLength(10);
    expect(result).toEqual(short);
  });

  it('many overwrites end up with the latest value', () => {
    for (let i = 0; i < 20; i++) {
      store.saveCredentialId(new Uint8Array([i]));
    }
    const result = store.getCredentialId()!;
    expect(result).toEqual(new Uint8Array([19]));
  });
});

// ---------------------------------------------------------------------------
// Concurrent access patterns
// ---------------------------------------------------------------------------

describe('CredentialStore — concurrent access patterns', () => {
  let store: CredentialStore;

  beforeEach(() => {
    store = new CredentialStore(new MockStorage());
  });

  it('rapid save-get cycle returns the last saved value', () => {
    // CredentialStore is synchronous — each save immediately overrides
    const values = Array.from({ length: 50 }, (_, i) => new Uint8Array([i]));

    for (const v of values) {
      store.saveCredentialId(v);
    }
    const result = store.getCredentialId()!;
    expect(result).toEqual(new Uint8Array([49]));
  });

  it('interleaved credentialId and publicKey saves do not corrupt each other', () => {
    const credId = new Uint8Array([0x01, 0x02, 0x03]);
    const pubKey = new Uint8Array([0x04, 0x05, 0x06]);

    store.saveCredentialId(credId);
    store.savePublicKey(pubKey);
    store.saveCredentialId(new Uint8Array([0x07]));
    store.savePublicKey(new Uint8Array([0x08]));

    expect(store.getCredentialId()).toEqual(new Uint8Array([0x07]));
    expect(store.getPublicKey()).toEqual(new Uint8Array([0x08]));
  });

  it('multiple reads return the same value without side effects', () => {
    const credId = new Uint8Array([0xaa, 0xbb, 0xcc]);
    store.saveCredentialId(credId);

    const reads = Array.from({ length: 20 }, () => store.getCredentialId());
    for (const r of reads) {
      expect(r).toEqual(credId);
    }
  });
});

// ---------------------------------------------------------------------------
// Base64 encoding correctness
// ---------------------------------------------------------------------------

describe('CredentialStore — base64 encoding correctness', () => {
  let store: CredentialStore;
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    store = new CredentialStore(storage);
  });

  it('stored value is valid base64 (no invalid characters)', () => {
    const credId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    store.saveCredentialId(credId);

    const raw = storage.getRaw('aztec-wallet:credentialId')!;
    expect(raw).toBeTruthy();

    // Valid base64 characters: A-Z, a-z, 0-9, +, /, = (padding)
    expect(raw).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('stored public key is valid base64', () => {
    const pubKey = new Uint8Array(65).fill(0x04);
    store.savePublicKey(pubKey);

    const raw = storage.getRaw('aztec-wallet:publicKey')!;
    expect(raw).toBeTruthy();
    expect(raw).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('base64 encoded value decodes to the original bytes using atob', () => {
    const credId = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    store.saveCredentialId(credId);

    const raw = storage.getRaw('aztec-wallet:credentialId')!;
    const decoded = atob(raw);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    expect(bytes).toEqual(credId);
  });

  it('stores credential ID and public key under separate storage keys', () => {
    store.saveCredentialId(new Uint8Array([1, 2]));
    store.savePublicKey(new Uint8Array([3, 4]));

    const credRaw = storage.getRaw('aztec-wallet:credentialId');
    const pubRaw = storage.getRaw('aztec-wallet:publicKey');

    expect(credRaw).not.toBeNull();
    expect(pubRaw).not.toBeNull();
    expect(credRaw).not.toBe(pubRaw);
    expect(storage.size()).toBe(2);
  });

  it('base64 is consistent with standard btoa encoding', () => {
    const credId = new Uint8Array([1, 2, 3]);
    store.saveCredentialId(credId);

    const raw = storage.getRaw('aztec-wallet:credentialId')!;

    // Manual btoa encoding of the same bytes
    let binary = '';
    for (const b of credId) binary += String.fromCharCode(b);
    const expected = btoa(binary);

    expect(raw).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Edge cases and null storage
// ---------------------------------------------------------------------------

describe('CredentialStore — edge cases', () => {
  it('null storage object does not throw on operations', () => {
    const store = new CredentialStore(null);
    // Should not throw even with null storage
    expect(() => store.saveCredentialId(new Uint8Array([1]))).not.toThrow();
    expect(() => store.savePublicKey(new Uint8Array([2]))).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    expect(store.getCredentialId()).toBeNull();
    expect(store.getPublicKey()).toBeNull();
  });

  it('clear sets both fields to null', () => {
    const storage = new MockStorage();
    const store = new CredentialStore(storage);

    store.saveCredentialId(new Uint8Array([1, 2, 3]));
    store.savePublicKey(new Uint8Array([4, 5, 6]));
    store.clear();

    expect(store.getCredentialId()).toBeNull();
    expect(store.getPublicKey()).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it('getCredentialId after clear then re-save returns new value', () => {
    const storage = new MockStorage();
    const store = new CredentialStore(storage);

    store.saveCredentialId(new Uint8Array([1]));
    store.clear();
    store.saveCredentialId(new Uint8Array([2]));

    expect(store.getCredentialId()).toEqual(new Uint8Array([2]));
  });

  it('empty Uint8Array produces empty base64 string which reads back as null', () => {
    // NOTE: uint8ArrayToBase64(empty) → btoa('') → ''
    // The storage.getItem() returns '' which is falsy,
    // so getCredentialId() returns null (not an empty Uint8Array).
    // This is the actual behavior of the current implementation.
    const storage = new MockStorage();
    const store = new CredentialStore(storage);

    const empty = new Uint8Array(0);
    store.saveCredentialId(empty);

    // btoa('') = '' → stored as '' → getItem returns '' → falsy → returns null
    const result = store.getCredentialId();
    expect(result).toBeNull();
  });

  it('stores independently in separate CredentialStore instances with same storage', () => {
    // Two stores sharing the same storage object
    const storage = new MockStorage();
    const store1 = new CredentialStore(storage);
    const store2 = new CredentialStore(storage);

    store1.saveCredentialId(new Uint8Array([0x11]));
    // store2 reads the same storage key — should see store1's value
    expect(store2.getCredentialId()).toEqual(new Uint8Array([0x11]));

    store2.saveCredentialId(new Uint8Array([0x22]));
    expect(store1.getCredentialId()).toEqual(new Uint8Array([0x22]));
  });
});
