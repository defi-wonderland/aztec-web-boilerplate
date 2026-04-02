import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMap } from '@/aztec-wallet/services/storage/InMemoryMap';

describe('InMemoryMap', () => {
  let map: InMemoryMap<string, string>;

  beforeEach(() => {
    map = new InMemoryMap<string, string>();
  });

  it('returns undefined for missing key', async () => {
    expect(await map.getAsync('missing')).toBeUndefined();
  });

  it('stores and retrieves a value', async () => {
    await map.set('key1', 'value1');
    expect(await map.getAsync('key1')).toBe('value1');
  });

  it('overwrites existing value', async () => {
    await map.set('key1', 'value1');
    await map.set('key1', 'value2');
    expect(await map.getAsync('key1')).toBe('value2');
  });

  it('deletes a key', async () => {
    await map.set('key1', 'value1');
    await map.delete('key1');
    expect(await map.getAsync('key1')).toBeUndefined();
  });

  it('reports hasAsync correctly', async () => {
    expect(await map.hasAsync('key1')).toBe(false);
    await map.set('key1', 'value1');
    expect(await map.hasAsync('key1')).toBe(true);
  });

  it('iterates keys', async () => {
    await map.set('a', '1');
    await map.set('b', '2');
    await map.set('c', '3');
    const keys: string[] = [];
    for await (const key of map.keysAsync()) {
      keys.push(key);
    }
    expect(keys.sort()).toEqual(['a', 'b', 'c']);
  });

  it('iterates values', async () => {
    await map.set('a', '1');
    await map.set('b', '2');
    const values: string[] = [];
    for await (const val of map.valuesAsync()) {
      values.push(val);
    }
    expect(values.sort()).toEqual(['1', '2']);
  });

  it('iterates entries', async () => {
    await map.set('a', '1');
    await map.set('b', '2');
    const entries: [string, string][] = [];
    for await (const entry of map.entriesAsync()) {
      entries.push(entry);
    }
    expect(entries.sort()).toEqual([['a', '1'], ['b', '2']]);
  });

  it('reports size', async () => {
    expect(await map.sizeAsync()).toBe(0);
    await map.set('a', '1');
    await map.set('b', '2');
    expect(await map.sizeAsync()).toBe(2);
  });

  it('setIfNotExists does not overwrite', async () => {
    await map.set('a', '1');
    const result = await map.setIfNotExists('a', '2');
    expect(result).toBe(false);
    expect(await map.getAsync('a')).toBe('1');
  });

  it('setIfNotExists sets when missing', async () => {
    const result = await map.setIfNotExists('a', '1');
    expect(result).toBe(true);
    expect(await map.getAsync('a')).toBe('1');
  });

  it('setMany sets multiple entries', async () => {
    await map.setMany([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(await map.getAsync('a')).toBe('1');
    expect(await map.getAsync('b')).toBe('2');
  });
});
