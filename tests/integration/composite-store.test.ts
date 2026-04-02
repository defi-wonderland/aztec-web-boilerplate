import { describe, it, expect } from 'vitest';
import { CompositeKVStore } from '@/aztec-wallet/services/storage/CompositeKVStore';
import { InMemoryKVStore } from '@/aztec-wallet/services/storage/InMemoryKVStore';

const EPHEMERAL_NAMES = new Set(['key_store', 'complete_addresses', 'complete_address_index']);

describe('CompositeKVStore with KeyStore pattern', () => {
  it('key_store writes go to ephemeral, not persistent', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    // Simulate what PXE's KeyStore does internally:
    // It calls store.openMap('key_store') and writes keys
    const keyStoreMap = composite.openMap<string, Buffer>('key_store');
    const testKey = Buffer.from('test-secret-key');
    await keyStoreMap.set('0xabc-ivsk_m', testKey);
    await keyStoreMap.set('0xabc-nhk_m', testKey);
    await keyStoreMap.set('0xabc-ovsk_m', testKey);
    await keyStoreMap.set('0xabc-tsk_m', testKey);

    // Verify keys are in ephemeral
    const ephKeyMap = ephemeral.openMap<string, Buffer>('key_store');
    expect(await ephKeyMap.getAsync('0xabc-ivsk_m')).toEqual(testKey);
    expect(await ephKeyMap.getAsync('0xabc-nhk_m')).toEqual(testKey);

    // Verify keys are NOT in persistent
    const persKeyMap = persistent.openMap<string, Buffer>('key_store');
    expect(await persKeyMap.getAsync('0xabc-ivsk_m')).toBeUndefined();

    // Simulate what PXE's NoteStore does — writes to note_store (should go to persistent)
    const noteMap = composite.openMap<string, string>('note_store');
    await noteMap.set('note1', 'encrypted_data');

    const persNoteMap = persistent.openMap<string, string>('note_store');
    expect(await persNoteMap.getAsync('note1')).toBe('encrypted_data');

    const ephNoteMap = ephemeral.openMap<string, string>('note_store');
    expect(await ephNoteMap.getAsync('note1')).toBeUndefined();
  });

  it('simulates session lifecycle: keys lost on ephemeral clear, notes survive', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    // Session 1: register keys + store notes
    const keyMap = composite.openMap<string, Buffer>('key_store');
    const noteMap = composite.openMap<string, string>('note_store');
    const testKey = Buffer.from('viewing-key');
    await keyMap.set('0xabc-ivsk_m', testKey);
    await noteMap.set('note1', 'encrypted_balance');

    // Verify both exist
    expect(await keyMap.getAsync('0xabc-ivsk_m')).toEqual(testKey);
    expect(await noteMap.getAsync('note1')).toBe('encrypted_balance');

    // Simulate page close: ephemeral store cleared (garbage collected in real life)
    await ephemeral.clear();

    // Session 2: create new ephemeral store (simulating fresh page load)
    const ephemeral2 = new InMemoryKVStore();
    const composite2 = new CompositeKVStore(persistent, ephemeral2, EPHEMERAL_NAMES);

    // Keys are GONE (ephemeral was cleared)
    const keyMap2 = composite2.openMap<string, Buffer>('key_store');
    expect(await keyMap2.getAsync('0xabc-ivsk_m')).toBeUndefined();

    // Notes SURVIVE (persistent store still has them)
    const noteMap2 = composite2.openMap<string, string>('note_store');
    expect(await noteMap2.getAsync('note1')).toBe('encrypted_balance');

    // Re-register keys (simulating biometric → PRF → registerAccount)
    await keyMap2.set('0xabc-ivsk_m', testKey);
    expect(await keyMap2.getAsync('0xabc-ivsk_m')).toEqual(testKey);
  });

  it('complete_addresses routes to ephemeral', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    const addrArray = composite.openArray<string>('complete_addresses');
    await addrArray.push('0xabc');

    const ephArray = ephemeral.openArray<string>('complete_addresses');
    expect(await ephArray.lengthAsync()).toBe(1);

    const persArray = persistent.openArray<string>('complete_addresses');
    expect(await persArray.lengthAsync()).toBe(0);
  });

  it('complete_address_index routes to ephemeral', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    const indexMap = composite.openMap<string, number>('complete_address_index');
    await indexMap.set('0xabc', 0);

    const ephMap = ephemeral.openMap<string, number>('complete_address_index');
    expect(await ephMap.getAsync('0xabc')).toBe(0);

    const persMap = persistent.openMap<string, number>('complete_address_index');
    expect(await persMap.getAsync('0xabc')).toBeUndefined();
  });

  it('non-ephemeral stores route to persistent only', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    const stores = ['note_store', 'nullifier_store', 'block_data', 'contract_classes'];

    for (const storeName of stores) {
      const map = composite.openMap<string, string>(storeName);
      await map.set('k', 'v');

      const persMap = persistent.openMap<string, string>(storeName);
      expect(await persMap.getAsync('k'), `${storeName} should be in persistent`).toBe('v');

      const ephMap = ephemeral.openMap<string, string>(storeName);
      expect(await ephMap.getAsync('k'), `${storeName} should NOT be in ephemeral`).toBeUndefined();
    }
  });

  it('estimateSize sums both stores', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    const size = await composite.estimateSize();
    expect(size).toEqual({
      mappingSize: 0,
      physicalFileSize: 0,
      actualSize: 0,
      numItems: 0,
    });
  });

  it('clear() wipes both stores', async () => {
    const persistent = new InMemoryKVStore();
    const ephemeral = new InMemoryKVStore();
    const composite = new CompositeKVStore(persistent, ephemeral, EPHEMERAL_NAMES);

    await composite.openMap<string, string>('note_store').set('k', 'v');
    await composite.openMap<string, string>('key_store').set('k2', 'v2');

    await composite.clear();

    const persMap = persistent.openMap<string, string>('note_store');
    expect(await persMap.getAsync('k')).toBeUndefined();

    const ephMap = ephemeral.openMap<string, string>('key_store');
    expect(await ephMap.getAsync('k2')).toBeUndefined();
  });
});
