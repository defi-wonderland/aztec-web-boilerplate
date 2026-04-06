/**
 * EncryptedKVStore Integration Tests
 *
 * Deep behavioral tests covering complex type round-trips, full iteration
 * semantics, MultiMap operations, Array lifecycle, delegation of Sets/Counters,
 * wrong-key rejection, clear/reuse, large values, and unicode handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptedKVStore } from '../EncryptedKVStore';
import { InMemoryKVStore } from '../../storage/InMemoryKVStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeStore(): Promise<{ store: EncryptedKVStore; key: CryptoKey; backing: InMemoryKVStore }> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const backing = new InMemoryKVStore();
  const store = new EncryptedKVStore(backing, key);
  return { store, key, backing };
}

async function makeKey(): Promise<CryptoKey> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// ---------------------------------------------------------------------------
// Round-trip complex types
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — complex type round-trips', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('stores and retrieves a nested object', async () => {
    const map = store.openMap<string, object>('complex');
    const value = { a: 1, b: { c: 'hello', d: [1, 2, 3] }, e: true };
    await map.set('nested', value);
    const result = await map.getAsync('nested');
    expect(result).toEqual(value);
  });

  it('stores and retrieves an array value', async () => {
    const map = store.openMap<string, number[]>('arrays');
    const value = [10, 20, 30, 40, 50];
    await map.set('arr', value);
    const result = await map.getAsync('arr');
    expect(result).toEqual(value);
  });

  it('stores and retrieves deeply nested structure', async () => {
    const map = store.openMap<string, object>('deep');
    const value = { level1: { level2: { level3: { level4: { data: 'deep' } } } } };
    await map.set('k', value);
    const result = await map.getAsync('k');
    expect(result).toEqual(value);
  });

  it('stores and retrieves bigint-as-string representation', async () => {
    // JSON does not natively support bigint; typical pattern is to stringify
    const map = store.openMap<string, string>('bigints');
    const bigStr = (21888242871839275222246405745257275088548364400416034343698204186575808495617n).toString();
    await map.set('fr_modulus', bigStr);
    const result = await map.getAsync('fr_modulus');
    expect(result).toBe(bigStr);
    expect(BigInt(result!)).toBe(21888242871839275222246405745257275088548364400416034343698204186575808495617n);
  });

  it('stores and retrieves null values correctly', async () => {
    const map = store.openMap<string, null>('nulls');
    await map.set('k', null);
    const result = await map.getAsync('k');
    expect(result).toBeNull();
  });

  it('stores and retrieves empty object and empty array', async () => {
    const map = store.openMap<string, object | unknown[]>('empty');
    await map.set('obj', {});
    await map.set('arr', []);
    expect(await map.getAsync('obj')).toEqual({});
    expect(await map.getAsync('arr')).toEqual([]);
  });

  it('stores and retrieves boolean values', async () => {
    const map = store.openMap<string, boolean>('booleans');
    await map.set('t', true);
    await map.set('f', false);
    expect(await map.getAsync('t')).toBe(true);
    expect(await map.getAsync('f')).toBe(false);
  });

  it('stores 20 entries and retrieves them all correctly', async () => {
    const map = store.openMap<string, number>('many');
    const entries: Array<[string, number]> = Array.from({ length: 20 }, (_, i) => [`key_${i}`, i * 100]);
    for (const [k, v] of entries) {
      await map.set(k, v);
    }
    for (const [k, v] of entries) {
      const result = await map.getAsync(k);
      expect(result).toBe(v);
    }
  });
});

// ---------------------------------------------------------------------------
// Map iteration
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — map iteration', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('keysAsync yields all 20 stored keys', async () => {
    const map = store.openMap<string, number>('iter');
    for (let i = 0; i < 20; i++) await map.set(`k${i}`, i);

    const keys: string[] = [];
    for await (const key of map.keysAsync()) {
      keys.push(key);
    }
    expect(keys).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      expect(keys).toContain(`k${i}`);
    }
  });

  it('valuesAsync decrypts and yields all 20 values', async () => {
    const map = store.openMap<string, number>('vals_iter');
    for (let i = 0; i < 20; i++) await map.set(`k${i}`, i * 7);

    const values: number[] = [];
    for await (const v of map.valuesAsync()) {
      values.push(v);
    }
    expect(values).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      expect(values).toContain(i * 7);
    }
  });

  it('entriesAsync yields all 20 [key, value] pairs with decrypted values', async () => {
    const map = store.openMap<string, string>('entries_iter');
    const expected = new Map<string, string>();
    for (let i = 0; i < 20; i++) {
      expected.set(`key_${i}`, `value_${i}`);
      await map.set(`key_${i}`, `value_${i}`);
    }

    const collected = new Map<string, string>();
    for await (const [k, v] of map.entriesAsync()) {
      collected.set(k, v);
    }

    expect(collected.size).toBe(20);
    for (const [k, v] of expected) {
      expect(collected.get(k)).toBe(v);
    }
  });

  it('sizeAsync reflects current number of entries', async () => {
    const map = store.openMap<string, number>('size_test');
    expect(await map.sizeAsync()).toBe(0);
    await map.set('a', 1);
    expect(await map.sizeAsync()).toBe(1);
    await map.set('b', 2);
    expect(await map.sizeAsync()).toBe(2);
  });

  it('hasAsync returns correct results before and after set/delete', async () => {
    const map = store.openMap<string, string>('has_test');
    expect(await map.hasAsync('x')).toBe(false);
    await map.set('x', 'present');
    expect(await map.hasAsync('x')).toBe(true);
    await map.delete('x');
    expect(await map.hasAsync('x')).toBe(false);
  });

  it('setMany stores multiple entries atomically and all are retrievable', async () => {
    const map = store.openMap<string, number>('set_many');
    await map.setMany([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]);
    expect(await map.getAsync('a')).toBe(1);
    expect(await map.getAsync('b')).toBe(2);
    expect(await map.getAsync('c')).toBe(3);
  });

  it('setIfNotExists does not overwrite existing value', async () => {
    const map = store.openMap<string, number>('if_not_exists');
    await map.set('x', 42);
    const inserted = await map.setIfNotExists('x', 99);
    expect(inserted).toBe(false);
    expect(await map.getAsync('x')).toBe(42);
  });

  it('setIfNotExists inserts when key does not exist', async () => {
    const map = store.openMap<string, number>('if_not_exists_new');
    const inserted = await map.setIfNotExists('new_key', 77);
    expect(inserted).toBe(true);
    expect(await map.getAsync('new_key')).toBe(77);
  });
});

// ---------------------------------------------------------------------------
// MultiMap operations
// ---------------------------------------------------------------------------

/**
 * NOTE: EncryptedMultiMap has a known structural limitation:
 * Its `set()` method is inherited from EncryptedMap, which writes to
 * `backingStore.openMap(name)`. However, `getValuesAsync()`, `getValueCountAsync()`,
 * and `deleteValue()` all use `backingStore.openMultiMap(name)`.
 *
 * In InMemoryKVStore, `openMap` and `openMultiMap` maintain separate
 * data stores. As a result, data written via `set()` is invisible to
 * `getValuesAsync()` — they operate on different backing collections.
 *
 * Tests below verify the actual behavior (both correct and limited aspects).
 */

describe('EncryptedKVStore — MultiMap operations', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('getValueCountAsync returns 0 for non-existent key', async () => {
    const multi = store.openMultiMap<string, number>('count_zero');
    expect(await multi.getValueCountAsync('missing')).toBe(0);
  });

  it('getValuesAsync yields no values for non-existent key', async () => {
    const multi = store.openMultiMap<string, string>('empty_multi');
    const values: string[] = [];
    for await (const v of multi.getValuesAsync('missing')) {
      values.push(v);
    }
    expect(values).toHaveLength(0);
  });

  it('openMultiMap set() and getValueCountAsync() use the same backing multi-map', async () => {
    const m1 = store.openMultiMap<string, number>('same_multi');
    const m2 = store.openMultiMap<string, number>('same_multi');
    // Write via m1, check count via m2 — both wrap the same openMultiMap backing
    await m1.set('k', 1);
    const count = await m2.getValueCountAsync('k');
    expect(count).toBe(1); // set() and getValueCountAsync() share the same backing
  });

  it('deleteValue on a non-existent key does not throw', async () => {
    const multi = store.openMultiMap<string, number>('no_throw_delete');
    // Should not throw — nothing to delete
    await expect(multi.deleteValue('nonexistent', 42)).resolves.toBeUndefined();
  });

  it('multiple keys in MultiMap have independent zero counts', async () => {
    const multi = store.openMultiMap<string, number>('multi_indep');
    expect(await multi.getValueCountAsync('a')).toBe(0);
    expect(await multi.getValueCountAsync('b')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Array operations
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — Array operations', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('push returns new length and atAsync retrieves by index', async () => {
    const arr = store.openArray<string>('arr');
    expect(await arr.push('a')).toBe(1);
    expect(await arr.push('b')).toBe(2);
    expect(await arr.push('c')).toBe(3);
    expect(await arr.atAsync(0)).toBe('a');
    expect(await arr.atAsync(1)).toBe('b');
    expect(await arr.atAsync(2)).toBe('c');
  });

  it('pop removes and returns the last element', async () => {
    const arr = store.openArray<number>('arr_pop');
    await arr.push(10, 20, 30);
    expect(await arr.pop()).toBe(30);
    expect(await arr.lengthAsync()).toBe(2);
    expect(await arr.pop()).toBe(20);
    expect(await arr.lengthAsync()).toBe(1);
  });

  it('pop on empty array returns undefined', async () => {
    const arr = store.openArray<string>('arr_empty_pop');
    expect(await arr.pop()).toBeUndefined();
  });

  it('setAt replaces value at index', async () => {
    const arr = store.openArray<number>('arr_set');
    await arr.push(1, 2, 3);
    const ok = await arr.setAt(1, 99);
    expect(ok).toBe(true);
    expect(await arr.atAsync(1)).toBe(99);
  });

  it('setAt returns false for out-of-bounds index', async () => {
    const arr = store.openArray<number>('arr_oob');
    await arr.push(1, 2, 3);
    const ok = await arr.setAt(10, 999);
    expect(ok).toBe(false);
  });

  it('lengthAsync returns correct length throughout lifecycle', async () => {
    const arr = store.openArray<string>('arr_len');
    expect(await arr.lengthAsync()).toBe(0);
    await arr.push('a', 'b', 'c');
    expect(await arr.lengthAsync()).toBe(3);
    await arr.pop();
    expect(await arr.lengthAsync()).toBe(2);
  });

  it('entriesAsync yields [index, decrypted_value] pairs', async () => {
    const arr = store.openArray<string>('arr_entries');
    await arr.push('x', 'y', 'z');

    const entries: Array<[number, string]> = [];
    for await (const entry of arr.entriesAsync()) {
      entries.push(entry);
    }
    expect(entries).toEqual([[0, 'x'], [1, 'y'], [2, 'z']]);
  });

  it('valuesAsync iterates all decrypted values in order', async () => {
    const arr = store.openArray<number>('arr_values');
    await arr.push(10, 20, 30, 40);

    const values: number[] = [];
    for await (const v of arr.valuesAsync()) {
      values.push(v);
    }
    expect(values).toEqual([10, 20, 30, 40]);
  });

  it('Symbol.asyncIterator works for for-await-of loop', async () => {
    const arr = store.openArray<string>('arr_iter');
    await arr.push('hello', 'world');

    const values: string[] = [];
    for await (const v of arr) {
      values.push(v);
    }
    expect(values).toEqual(['hello', 'world']);
  });

  it('push multiple values at once', async () => {
    const arr = store.openArray<number>('arr_multi_push');
    const newLen = await arr.push(1, 2, 3, 4, 5);
    expect(newLen).toBe(5);
    expect(await arr.lengthAsync()).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(await arr.atAsync(i)).toBe(i + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Counter operations (passthrough, not encrypted)
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — Counter passthrough', () => {
  let store: EncryptedKVStore;
  let backing: InMemoryKVStore;

  beforeEach(async () => {
    ({ store, backing } = await makeStore());
  });

  it('counter operations work through EncryptedKVStore', async () => {
    const counter = store.openCounter<string>('cnt');
    await counter.set('hits', 5);
    expect(await counter.getAsync('hits')).toBe(5);
  });

  it('counter update increments correctly', async () => {
    const counter = store.openCounter<string>('cnt_update');
    await counter.set('n', 10);
    await counter.update('n', 5);
    expect(await counter.getAsync('n')).toBe(15);
  });

  it('counter is the same instance from backing store (not wrapped)', () => {
    const counterFromEncrypted = store.openCounter<string>('cnt_same');
    const counterFromBacking = backing.openCounter<string>('cnt_same');
    // Both should be the same underlying object since counters are delegated directly
    expect(counterFromEncrypted).toBe(counterFromBacking);
  });
});

// ---------------------------------------------------------------------------
// Set operations (passthrough, not encrypted)
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — Set passthrough', () => {
  let store: EncryptedKVStore;
  let backing: InMemoryKVStore;

  beforeEach(async () => {
    ({ store, backing } = await makeStore());
  });

  it('set operations work through EncryptedKVStore', async () => {
    const s = store.openSet<string>('myset');
    await s.add('a');
    await s.add('b');
    expect(await s.hasAsync('a')).toBe(true);
    expect(await s.hasAsync('c')).toBe(false);
  });

  it('set delete works', async () => {
    const s = store.openSet<string>('del_set');
    await s.add('x');
    await s.delete('x');
    expect(await s.hasAsync('x')).toBe(false);
  });

  it('set is the same instance from backing store (not wrapped)', () => {
    const setFromEncrypted = store.openSet<string>('passthrough_set');
    const setFromBacking = backing.openSet<string>('passthrough_set');
    expect(setFromEncrypted).toBe(setFromBacking);
  });
});

// ---------------------------------------------------------------------------
// Transaction support
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — transaction support', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('transactionAsync executes callback and returns result', async () => {
    const result = await store.transactionAsync(async () => {
      const map = store.openMap<string, string>('tx_map');
      await map.set('txKey', 'txValue');
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('data written inside transaction is persisted after commit', async () => {
    await store.transactionAsync(async () => {
      const map = store.openMap<string, number>('tx_data');
      await map.set('counter', 42);
    });
    const map = store.openMap<string, number>('tx_data');
    expect(await map.getAsync('counter')).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Wrong key rejection
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — wrong key rejection', () => {
  it('data encrypted with key A cannot be decrypted with key B', async () => {
    const rawKeyA = crypto.getRandomValues(new Uint8Array(32));
    const rawKeyB = crypto.getRandomValues(new Uint8Array(32));
    const keyA = await crypto.subtle.importKey('raw', rawKeyA, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const keyB = await crypto.subtle.importKey('raw', rawKeyB, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

    // Write with key A
    const backing = new InMemoryKVStore();
    const storeA = new EncryptedKVStore(backing, keyA);
    const mapA = storeA.openMap<string, string>('shared_map');
    await mapA.set('secret', 'top secret value');

    // Read with key B (using the SAME backing store)
    const storeB = new EncryptedKVStore(backing, keyB);
    const mapB = storeB.openMap<string, string>('shared_map');

    // Should throw or return garbage — decryption will fail
    await expect(mapB.getAsync('secret')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Clear and reuse
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — clear and reuse', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('clear removes all data from all store types', async () => {
    const map = store.openMap<string, string>('m');
    const singleton = store.openSingleton<number>('s');
    const arr = store.openArray<string>('a');

    await map.set('k', 'v');
    await singleton.set(99);
    await arr.push('x');

    await store.clear();

    expect(await map.getAsync('k')).toBeUndefined();
    expect(await singleton.getAsync()).toBeUndefined();
    expect(await arr.atAsync(0)).toBeUndefined();
  });

  it('can write new data after clear', async () => {
    const map = store.openMap<string, string>('reuse_map');
    await map.set('before', 'old');
    await store.clear();
    await map.set('after', 'new');

    expect(await map.getAsync('before')).toBeUndefined();
    expect(await map.getAsync('after')).toBe('new');
  });

  it('multiple clears work correctly', async () => {
    const map = store.openMap<string, number>('multi_clear');
    await map.set('x', 1);
    await store.clear();
    await map.set('y', 2);
    await store.clear();
    await map.set('z', 3);

    expect(await map.getAsync('x')).toBeUndefined();
    expect(await map.getAsync('y')).toBeUndefined();
    expect(await map.getAsync('z')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Large values
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — large values', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('stores and retrieves a 10KB string value', async () => {
    const map = store.openMap<string, string>('large');
    const big = 'A'.repeat(10_000);
    await map.set('big', big);
    const result = await map.getAsync('big');
    expect(result).toBe(big);
    expect(result!.length).toBe(10_000);
  });

  it('stores and retrieves a 100KB JSON object', async () => {
    const map = store.openMap<string, object>('huge');
    const obj = { data: 'x'.repeat(95_000), meta: { size: 95000 } };
    await map.set('large_obj', obj);
    const result = await map.getAsync('large_obj') as typeof obj;
    expect(result.data.length).toBe(95_000);
    expect(result.meta.size).toBe(95000);
  });

  it('singleton handles large value', async () => {
    const singleton = store.openSingleton<string>('big_singleton');
    const big = 'Z'.repeat(50_000);
    await singleton.set(big);
    const result = await singleton.getAsync();
    expect(result).toBe(big);
  });

  it('array handles many large entries', async () => {
    const arr = store.openArray<string>('large_arr');
    const entries = Array.from({ length: 10 }, (_, i) => `item_${i}_${'x'.repeat(1000)}`);
    await arr.push(...entries);

    expect(await arr.lengthAsync()).toBe(10);
    for (let i = 0; i < 10; i++) {
      const val = await arr.atAsync(i);
      expect(val).toBe(entries[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Unicode handling
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — unicode handling', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('stores and retrieves emoji strings', async () => {
    const map = store.openMap<string, string>('emoji');
    const emojiStr = '🔐💎🎉🚀🌟👾🦄🌈';
    await map.set('emojis', emojiStr);
    const result = await map.getAsync('emojis');
    expect(result).toBe(emojiStr);
  });

  it('stores and retrieves CJK characters', async () => {
    const map = store.openMap<string, string>('cjk');
    const cjk = '你好世界 こんにちは 안녕하세요 中文字符';
    await map.set('cjk', cjk);
    const result = await map.getAsync('cjk');
    expect(result).toBe(cjk);
  });

  it('stores and retrieves mixed unicode with control characters', async () => {
    const map = store.openMap<string, string>('mixed');
    const mixed = 'Hello\nWorld\t"quotes" & <tags> ñ é ü ö ä';
    await map.set('mixed', mixed);
    const result = await map.getAsync('mixed');
    expect(result).toBe(mixed);
  });

  it('stores and retrieves surrogate pairs correctly', async () => {
    const map = store.openMap<string, string>('surrogates');
    // Mathematical bold A (outside BMP, uses surrogate pair)
    const surrogate = '\uD835\uDC00 \uD83D\uDE00 \uD83E\uDD84';
    await map.set('surr', surrogate);
    const result = await map.getAsync('surr');
    expect(result).toBe(surrogate);
  });

  it('uses unicode keys correctly', async () => {
    const map = store.openMap<string, number>('unicode_keys');
    await map.set('键名', 42);
    await map.set('キー', 99);
    expect(await map.getAsync('键名')).toBe(42);
    expect(await map.getAsync('キー')).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Singleton lifecycle
// ---------------------------------------------------------------------------

describe('EncryptedKVStore — Singleton lifecycle', () => {
  let store: EncryptedKVStore;

  beforeEach(async () => {
    ({ store } = await makeStore());
  });

  it('returns undefined when not set', async () => {
    const s = store.openSingleton<string>('empty_sing');
    expect(await s.getAsync()).toBeUndefined();
  });

  it('delete returns true when value existed', async () => {
    const s = store.openSingleton<number>('del_sing');
    await s.set(42);
    const deleted = await s.delete();
    expect(deleted).toBe(true);
    expect(await s.getAsync()).toBeUndefined();
  });

  it('delete returns false when no value', async () => {
    const s = store.openSingleton<number>('del_empty_sing');
    const deleted = await s.delete();
    expect(deleted).toBe(false);
  });

  it('overwrite: second set replaces first', async () => {
    const s = store.openSingleton<string>('overwrite_sing');
    await s.set('first');
    await s.set('second');
    expect(await s.getAsync()).toBe('second');
  });
});
