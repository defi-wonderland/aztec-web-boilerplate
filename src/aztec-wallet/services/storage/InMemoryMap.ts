import type { AztecAsyncMap, Range } from '@aztec/kv-store/interfaces';
import type { Key, Value } from '@aztec/kv-store/interfaces';

export class InMemoryMap<K extends Key, V extends Value>
  implements AztecAsyncMap<K, V>
{
  private data = new Map<string, V>();

  private serialize(key: K): string {
    if (key instanceof Uint8Array) return Array.from(key).join(',');
    if (Array.isArray(key)) return key.join(',');
    return String(key);
  }

  async set(key: K, val: V): Promise<void> {
    this.data.set(this.serialize(key), val);
  }

  async setMany(entries: { key: K; value: V }[]): Promise<void> {
    for (const { key, value } of entries) {
      this.data.set(this.serialize(key), value);
    }
  }

  async setIfNotExists(key: K, val: V): Promise<boolean> {
    const k = this.serialize(key);
    if (this.data.has(k)) return false;
    this.data.set(k, val);
    return true;
  }

  async delete(key: K): Promise<void> {
    this.data.delete(this.serialize(key));
  }

  async getAsync(key: K): Promise<V | undefined> {
    return this.data.get(this.serialize(key));
  }

  async hasAsync(key: K): Promise<boolean> {
    return this.data.has(this.serialize(key));
  }

  async *keysAsync(_range?: Range<K>): AsyncIterableIterator<K> {
    for (const key of this.data.keys()) {
      yield key as unknown as K;
    }
  }

  async *valuesAsync(_range?: Range<K>): AsyncIterableIterator<V> {
    for (const val of this.data.values()) {
      yield val;
    }
  }

  async *entriesAsync(_range?: Range<K>): AsyncIterableIterator<[K, V]> {
    for (const [key, val] of this.data.entries()) {
      yield [key as unknown as K, val];
    }
  }

  async sizeAsync(): Promise<number> {
    return this.data.size;
  }
}
