import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptedKVStore } from '../EncryptedKVStore';
import { InMemoryKVStore } from '../../storage/InMemoryKVStore';

describe('EncryptedKVStore', () => {
  let store: EncryptedKVStore;
  let encryptionKey: CryptoKey;

  beforeEach(async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    encryptionKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
    );
    const backing = new InMemoryKVStore();
    store = new EncryptedKVStore(backing, encryptionKey);
  });

  it('map: encrypts values on set and decrypts on get', async () => {
    const map = store.openMap<string, string>('test_map');
    await map.set('key1', 'hello world');
    const result = await map.getAsync('key1');
    expect(result).toBe('hello world');
  });

  it('singleton: encrypts value on set and decrypts on get', async () => {
    const singleton = store.openSingleton<number>('test_singleton');
    await singleton.set(42);
    const result = await singleton.getAsync();
    expect(result).toBe(42);
  });

  it('array: encrypts values and decrypts on read', async () => {
    const arr = store.openArray<string>('test_array');
    await arr.push('a', 'b', 'c');
    const result = await arr.atAsync(1);
    expect(result).toBe('b');
  });

  it('clear removes all data', async () => {
    const map = store.openMap<string, string>('test_map');
    await map.set('key', 'val');
    await store.clear();
    const result = await map.getAsync('key');
    expect(result).toBeUndefined();
  });
});
