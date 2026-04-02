import type {
  AztecAsyncArray,
  AztecAsyncCounter,
  AztecAsyncKVStore,
  AztecAsyncMap,
  AztecAsyncMultiMap,
  AztecAsyncSet,
  AztecAsyncSingleton,
  Key,
  Range,
  StoreSize,
  Value,
} from '@aztec/kv-store/interfaces';

import { InMemoryMap } from './InMemoryMap.js';

// ---------------------------------------------------------------------------
// InMemorySingleton
// ---------------------------------------------------------------------------

class InMemorySingleton<T> implements AztecAsyncSingleton<T> {
  private value: T | undefined = undefined;

  async set(val: T): Promise<boolean> {
    this.value = val;
    return true;
  }

  async delete(): Promise<boolean> {
    const had = this.value !== undefined;
    this.value = undefined;
    return had;
  }

  async getAsync(): Promise<T | undefined> {
    return this.value;
  }
}

// ---------------------------------------------------------------------------
// InMemoryArray
// ---------------------------------------------------------------------------

class InMemoryArray<T extends Value> implements AztecAsyncArray<T> {
  private data: T[] = [];

  async push(...vals: T[]): Promise<number> {
    this.data.push(...vals);
    return this.data.length;
  }

  async pop(): Promise<T | undefined> {
    return this.data.pop();
  }

  async setAt(index: number, val: T): Promise<boolean> {
    const len = this.data.length;
    const resolved = index < 0 ? len + index : index;
    if (resolved < 0 || resolved >= len) return false;
    this.data[resolved] = val;
    return true;
  }

  async lengthAsync(): Promise<number> {
    return this.data.length;
  }

  async atAsync(index: number): Promise<T | undefined> {
    const len = this.data.length;
    const resolved = index < 0 ? len + index : index;
    if (resolved < 0 || resolved >= len) return undefined;
    return this.data[resolved];
  }

  async *entriesAsync(): AsyncIterableIterator<[number, T]> {
    for (let i = 0; i < this.data.length; i++) {
      yield [i, this.data[i]];
    }
  }

  async *valuesAsync(): AsyncIterableIterator<T> {
    for (const v of this.data) {
      yield v;
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this.valuesAsync();
  }
}

// ---------------------------------------------------------------------------
// InMemorySet
// ---------------------------------------------------------------------------

class InMemorySet<K extends Key> implements AztecAsyncSet<K> {
  private data = new Set<string>();

  private serialize(key: K): string {
    if (key instanceof Uint8Array) return Array.from(key).join(',');
    if (Array.isArray(key)) return key.join(',');
    return String(key);
  }

  async add(key: K): Promise<void> {
    this.data.add(this.serialize(key));
  }

  async delete(key: K): Promise<void> {
    this.data.delete(this.serialize(key));
  }

  async hasAsync(key: K): Promise<boolean> {
    return this.data.has(this.serialize(key));
  }

  async *entriesAsync(_range?: Range<K>): AsyncIterableIterator<K> {
    for (const k of this.data) {
      yield k as unknown as K;
    }
  }
}

// ---------------------------------------------------------------------------
// InMemoryMultiMap
// ---------------------------------------------------------------------------

class InMemoryMultiMap<K extends Key, V extends Value>
  extends InMemoryMap<K, V>
  implements AztecAsyncMultiMap<K, V>
{
  // Multi-value storage: serialized key → array of values
  private multi = new Map<string, V[]>();

  private serializeKey(key: K): string {
    if (key instanceof Uint8Array) return Array.from(key).join(',');
    if (Array.isArray(key)) return key.join(',');
    return String(key);
  }

  // Override set to also track in multi storage
  override async set(key: K, val: V): Promise<void> {
    const k = this.serializeKey(key);
    const existing = this.multi.get(k) ?? [];
    existing.push(val);
    this.multi.set(k, existing);
    await super.set(key, val);
  }

  // Override delete to clear multi storage
  override async delete(key: K): Promise<void> {
    this.multi.delete(this.serializeKey(key));
    await super.delete(key);
  }

  async *getValuesAsync(key: K): AsyncIterableIterator<V> {
    const vals = this.multi.get(this.serializeKey(key)) ?? [];
    for (const v of vals) {
      yield v;
    }
  }

  async getValueCountAsync(key: K): Promise<number> {
    return (this.multi.get(this.serializeKey(key)) ?? []).length;
  }

  async deleteValue(key: K, val: V): Promise<void> {
    const k = this.serializeKey(key);
    const existing = this.multi.get(k);
    if (!existing) return;
    const idx = existing.indexOf(val);
    if (idx !== -1) {
      existing.splice(idx, 1);
    }
    if (existing.length === 0) {
      this.multi.delete(k);
      await super.delete(key);
    } else {
      this.multi.set(k, existing);
      // Update the base map to hold the last remaining value
      await super.set(key, existing[existing.length - 1]);
    }
  }
}

// ---------------------------------------------------------------------------
// InMemoryCounter
// ---------------------------------------------------------------------------

class InMemoryCounter<K extends Key> implements AztecAsyncCounter<K> {
  private data = new Map<string, number>();

  private serialize(key: K): string {
    if (key instanceof Uint8Array) return Array.from(key).join(',');
    if (Array.isArray(key)) return key.join(',');
    return String(key);
  }

  async set(key: K, value: number): Promise<void> {
    if (value === 0) {
      this.data.delete(this.serialize(key));
    } else {
      this.data.set(this.serialize(key), value);
    }
  }

  async update(key: K, delta: number): Promise<void> {
    const k = this.serialize(key);
    const current = this.data.get(k) ?? 0;
    const next = current + delta;
    if (next <= 0) {
      this.data.delete(k);
    } else {
      this.data.set(k, next);
    }
  }

  async getAsync(key: K): Promise<number> {
    return this.data.get(this.serialize(key)) ?? 0;
  }

  async *keysAsync(_range?: Range<K>): AsyncIterableIterator<K> {
    for (const k of this.data.keys()) {
      yield k as unknown as K;
    }
  }

  async *entriesAsync(_range?: Range<K>): AsyncIterableIterator<[K, number]> {
    for (const [k, v] of this.data.entries()) {
      yield [k as unknown as K, v];
    }
  }
}

// ---------------------------------------------------------------------------
// InMemoryKVStore
// ---------------------------------------------------------------------------

export class InMemoryKVStore implements AztecAsyncKVStore {
  private maps = new Map<string, AztecAsyncMap<Key, Value>>();
  private sets = new Map<string, AztecAsyncSet<Key>>();
  private multiMaps = new Map<string, AztecAsyncMultiMap<Key, Value>>();
  private arrays = new Map<string, AztecAsyncArray<Value>>();
  private singletons = new Map<string, AztecAsyncSingleton<Value>>();
  private counters = new Map<string, AztecAsyncCounter<Key>>();

  openMap<K extends Key, V extends Value>(name: string): AztecAsyncMap<K, V> {
    if (!this.maps.has(name)) {
      this.maps.set(name, new InMemoryMap<K, V>() as AztecAsyncMap<Key, Value>);
    }
    return this.maps.get(name)! as AztecAsyncMap<K, V>;
  }

  openSet<K extends Key>(name: string): AztecAsyncSet<K> {
    if (!this.sets.has(name)) {
      this.sets.set(name, new InMemorySet<K>() as AztecAsyncSet<Key>);
    }
    return this.sets.get(name)! as AztecAsyncSet<K>;
  }

  openMultiMap<K extends Key, V extends Value>(name: string): AztecAsyncMultiMap<K, V> {
    if (!this.multiMaps.has(name)) {
      this.multiMaps.set(name, new InMemoryMultiMap<K, V>() as AztecAsyncMultiMap<Key, Value>);
    }
    return this.multiMaps.get(name)! as AztecAsyncMultiMap<K, V>;
  }

  openArray<T extends Value>(name: string): AztecAsyncArray<T> {
    if (!this.arrays.has(name)) {
      this.arrays.set(name, new InMemoryArray<T>() as AztecAsyncArray<Value>);
    }
    return this.arrays.get(name)! as AztecAsyncArray<T>;
  }

  openSingleton<T extends Value>(name: string): AztecAsyncSingleton<T> {
    if (!this.singletons.has(name)) {
      this.singletons.set(name, new InMemorySingleton<T>() as AztecAsyncSingleton<Value>);
    }
    return this.singletons.get(name)! as AztecAsyncSingleton<T>;
  }

  openCounter<K extends Key>(name: string): AztecAsyncCounter<K> {
    if (!this.counters.has(name)) {
      this.counters.set(name, new InMemoryCounter<K>() as AztecAsyncCounter<Key>);
    }
    return this.counters.get(name)! as AztecAsyncCounter<K>;
  }

  async transactionAsync<T extends Exclude<any, Promise<any>>>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  async clear(): Promise<void> {
    this.maps.clear();
    this.sets.clear();
    this.multiMaps.clear();
    this.arrays.clear();
    this.singletons.clear();
    this.counters.clear();
  }

  async delete(): Promise<void> {
    await this.clear();
  }

  async estimateSize(): Promise<StoreSize> {
    return { mappingSize: 0, physicalFileSize: 0, actualSize: 0, numItems: 0 };
  }

  async close(): Promise<void> {
    // no-op
  }

  async backupTo(_dstPath: string, _compact?: boolean): Promise<void> {
    throw new Error('InMemoryKVStore does not support backupTo');
  }
}
