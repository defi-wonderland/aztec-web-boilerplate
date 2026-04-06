import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialStore } from '../CredentialStore';

class MockStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('CredentialStore', () => {
  let store: CredentialStore;
  beforeEach(() => { store = new CredentialStore(new MockStorage()); });

  it('saves and retrieves credential ID', () => {
    const credId = new Uint8Array([1, 2, 3, 4]);
    store.saveCredentialId(credId);
    expect(store.getCredentialId()).toEqual(credId);
  });

  it('returns null when no credential stored', () => {
    expect(store.getCredentialId()).toBeNull();
  });

  it('saves and retrieves public key', () => {
    const pubKey = new Uint8Array(65).fill(0x04);
    store.savePublicKey(pubKey);
    expect(store.getPublicKey()).toEqual(pubKey);
  });

  it('clears all stored data', () => {
    store.saveCredentialId(new Uint8Array([1]));
    store.savePublicKey(new Uint8Array([2]));
    store.clear();
    expect(store.getCredentialId()).toBeNull();
    expect(store.getPublicKey()).toBeNull();
  });
});
