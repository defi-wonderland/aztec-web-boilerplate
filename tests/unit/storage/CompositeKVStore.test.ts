import { describe, it, expect, beforeEach } from 'vitest';
import { CompositeKVStore } from '@/aztec-wallet/services/storage/CompositeKVStore';
import { InMemoryKVStore } from '@/aztec-wallet/services/storage/InMemoryKVStore';

describe('CompositeKVStore', () => {
  let persistent: InMemoryKVStore;
  let ephemeral: InMemoryKVStore;
  let composite: CompositeKVStore;

  beforeEach(() => {
    persistent = new InMemoryKVStore();
    ephemeral = new InMemoryKVStore();
    composite = new CompositeKVStore(persistent, ephemeral, new Set(['key_store', 'address_store']));
  });

  it('routes ephemeral maps to the ephemeral store', async () => {
    const keyMap = composite.openMap<string, string>('key_store');
    await keyMap.set('alice-ivsk_m', 'secret_viewing_key');

    const ephemeralMap = ephemeral.openMap<string, string>('key_store');
    expect(await ephemeralMap.getAsync('alice-ivsk_m')).toBe('secret_viewing_key');

    const persistentMap = persistent.openMap<string, string>('key_store');
    expect(await persistentMap.getAsync('alice-ivsk_m')).toBeUndefined();
  });

  it('routes persistent maps to the persistent store', async () => {
    const noteMap = composite.openMap<string, string>('note_store');
    await noteMap.set('note1', 'encrypted_note_data');

    const persistentMap = persistent.openMap<string, string>('note_store');
    expect(await persistentMap.getAsync('note1')).toBe('encrypted_note_data');

    const ephemeralMap = ephemeral.openMap<string, string>('note_store');
    expect(await ephemeralMap.getAsync('note1')).toBeUndefined();
  });

  it('routes address_store to ephemeral', async () => {
    const addrMap = composite.openMap<string, string>('address_store');
    await addrMap.set('addr', '0x123');

    const ephemeralMap = ephemeral.openMap<string, string>('address_store');
    expect(await ephemeralMap.getAsync('addr')).toBe('0x123');
  });

  it('uses exact name matching (no prefix match)', async () => {
    const metaSingleton = composite.openSingleton<string>('key_store_meta');
    await metaSingleton.set('data');
    // 'key_store_meta' != 'key_store' — goes to persistent
    expect(await persistent.openSingleton<string>('key_store_meta').getAsync()).toBe('data');
  });

  it('clear clears both stores', async () => {
    const keyMap = composite.openMap<string, string>('key_store');
    const noteMap = composite.openMap<string, string>('note_store');
    await keyMap.set('k', 'v');
    await noteMap.set('k', 'v');

    await composite.clear();

    const keyMap2 = composite.openMap<string, string>('key_store');
    const noteMap2 = composite.openMap<string, string>('note_store');
    expect(await keyMap2.getAsync('k')).toBeUndefined();
    expect(await noteMap2.getAsync('k')).toBeUndefined();
  });

  it('returns same instance for same name', () => {
    const map1 = composite.openMap<string, string>('key_store');
    const map2 = composite.openMap<string, string>('key_store');
    expect(map1).toBe(map2);
  });

  it('transactionAsync delegates to persistent store', async () => {
    const result = await composite.transactionAsync(async () => {
      const map = composite.openMap<string, string>('note_store');
      await map.set('k', 'v');
      return 42;
    });
    expect(result).toBe(42);
  });
});
