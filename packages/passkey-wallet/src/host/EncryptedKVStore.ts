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

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

const IV_BYTES = 12;

async function encrypt(encryptionKey: CryptoKey, value: unknown): Promise<Uint8Array> {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, plaintext);
  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);
  return result;
}

async function decrypt<T>(encryptionKey: CryptoKey, data: Uint8Array): Promise<T> {
  const iv = data.slice(0, IV_BYTES);
  const ciphertext = data.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encryptionKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

// ---------------------------------------------------------------------------
// EncryptedMap
// ---------------------------------------------------------------------------

class EncryptedMap<K extends Key, V extends Value> implements AztecAsyncMap<K, V> {
  constructor(
    private readonly backingStore: AztecAsyncKVStore,
    private readonly name: string,
    private readonly encryptionKey: CryptoKey,
  ) {}

  private get backing(): AztecAsyncMap<K, Uint8Array> {
    return this.backingStore.openMap<K, Uint8Array>(this.name);
  }

  async set(key: K, val: V): Promise<void> {
    const encrypted = await encrypt(this.encryptionKey, val);
    await this.backing.set(key, encrypted);
  }

  async setMany(entries: { key: K; value: V }[]): Promise<void> {
    const encryptedEntries = await Promise.all(
      entries.map(async ({ key, value }) => ({
        key,
        value: await encrypt(this.encryptionKey, value),
      })),
    );
    await this.backing.setMany(encryptedEntries);
  }

  async setIfNotExists(key: K, val: V): Promise<boolean> {
    const encrypted = await encrypt(this.encryptionKey, val);
    return this.backing.setIfNotExists(key, encrypted);
  }

  async delete(key: K): Promise<void> {
    return this.backing.delete(key);
  }

  async getAsync(key: K): Promise<V | undefined> {
    const raw = await this.backing.getAsync(key);
    if (raw === undefined) return undefined;
    return decrypt<V>(this.encryptionKey, raw);
  }

  async hasAsync(key: K): Promise<boolean> {
    return this.backing.hasAsync(key);
  }

  async *keysAsync(range?: Range<K>): AsyncIterableIterator<K> {
    yield* this.backing.keysAsync(range);
  }

  async *valuesAsync(range?: Range<K>): AsyncIterableIterator<V> {
    for await (const raw of this.backing.valuesAsync(range)) {
      yield decrypt<V>(this.encryptionKey, raw);
    }
  }

  async *entriesAsync(range?: Range<K>): AsyncIterableIterator<[K, V]> {
    for await (const [key, raw] of this.backing.entriesAsync(range)) {
      yield [key, await decrypt<V>(this.encryptionKey, raw)];
    }
  }

  async sizeAsync(): Promise<number> {
    return this.backing.sizeAsync();
  }
}

// ---------------------------------------------------------------------------
// EncryptedMultiMap
// ---------------------------------------------------------------------------

class EncryptedMultiMap<K extends Key, V extends Value> implements AztecAsyncMultiMap<K, V> {
  private readonly backing: AztecAsyncMultiMap<K, Uint8Array>;

  constructor(
    backingStore: AztecAsyncKVStore,
    name: string,
    private readonly encryptionKey: CryptoKey,
  ) {
    this.backing = backingStore.openMultiMap<K, Uint8Array>(name);
  }

  async set(key: K, val: V): Promise<void> {
    const encrypted = await encrypt(this.encryptionKey, val);
    await this.backing.set(key, encrypted);
  }

  async setMany(entries: { key: K; value: V }[]): Promise<void> {
    const encryptedEntries = await Promise.all(
      entries.map(async ({ key, value }) => ({
        key,
        value: await encrypt(this.encryptionKey, value),
      })),
    );
    await this.backing.setMany(encryptedEntries);
  }

  async setIfNotExists(key: K, val: V): Promise<boolean> {
    const encrypted = await encrypt(this.encryptionKey, val);
    return this.backing.setIfNotExists(key, encrypted);
  }

  async delete(key: K): Promise<void> {
    return this.backing.delete(key);
  }

  async getAsync(key: K): Promise<V | undefined> {
    const raw = await this.backing.getAsync(key);
    if (raw === undefined) return undefined;
    return decrypt<V>(this.encryptionKey, raw);
  }

  async hasAsync(key: K): Promise<boolean> {
    return this.backing.hasAsync(key);
  }

  async *keysAsync(range?: Range<K>): AsyncIterableIterator<K> {
    yield* this.backing.keysAsync(range);
  }

  async *valuesAsync(range?: Range<K>): AsyncIterableIterator<V> {
    for await (const raw of this.backing.valuesAsync(range)) {
      yield decrypt<V>(this.encryptionKey, raw);
    }
  }

  async *entriesAsync(range?: Range<K>): AsyncIterableIterator<[K, V]> {
    for await (const [key, raw] of this.backing.entriesAsync(range)) {
      yield [key, await decrypt<V>(this.encryptionKey, raw)];
    }
  }

  async sizeAsync(): Promise<number> {
    return this.backing.sizeAsync();
  }

  async *getValuesAsync(key: K): AsyncIterableIterator<V> {
    for await (const raw of this.backing.getValuesAsync(key)) {
      yield decrypt<V>(this.encryptionKey, raw);
    }
  }

  async getValueCountAsync(key: K): Promise<number> {
    return this.backing.getValueCountAsync(key);
  }

  async deleteValue(key: K, val: V): Promise<void> {
    // We can't find the exact ciphertext to delete (different IV each time),
    // so we must decrypt all values and find the match
    const allRaw: Uint8Array[] = [];
    for await (const raw of this.backing.getValuesAsync(key)) {
      allRaw.push(raw);
    }
    for (const raw of allRaw) {
      const decrypted = await decrypt<V>(this.encryptionKey, raw);
      if (JSON.stringify(decrypted) === JSON.stringify(val)) {
        await this.backing.deleteValue(key, raw);
        return;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// EncryptedSingleton
// ---------------------------------------------------------------------------

class EncryptedSingleton<T> implements AztecAsyncSingleton<T> {
  constructor(
    private readonly backingStore: AztecAsyncKVStore,
    private readonly name: string,
    private readonly encryptionKey: CryptoKey,
  ) {}

  private get backing(): AztecAsyncSingleton<Uint8Array> {
    return this.backingStore.openSingleton<Uint8Array>(this.name);
  }

  async set(val: T): Promise<boolean> {
    const encrypted = await encrypt(this.encryptionKey, val);
    return this.backing.set(encrypted);
  }

  async delete(): Promise<boolean> {
    return this.backing.delete();
  }

  async getAsync(): Promise<T | undefined> {
    const raw = await this.backing.getAsync();
    if (raw === undefined) return undefined;
    return decrypt<T>(this.encryptionKey, raw);
  }
}

// ---------------------------------------------------------------------------
// EncryptedArray
// ---------------------------------------------------------------------------

class EncryptedArray<T extends Value> implements AztecAsyncArray<T> {
  constructor(
    private readonly backingStore: AztecAsyncKVStore,
    private readonly name: string,
    private readonly encryptionKey: CryptoKey,
  ) {}

  private get backing(): AztecAsyncArray<Uint8Array> {
    return this.backingStore.openArray<Uint8Array>(this.name);
  }

  async push(...vals: T[]): Promise<number> {
    const encrypted = await Promise.all(vals.map(v => encrypt(this.encryptionKey, v)));
    return this.backing.push(...encrypted);
  }

  async pop(): Promise<T | undefined> {
    const raw = await this.backing.pop();
    if (raw === undefined) return undefined;
    return decrypt<T>(this.encryptionKey, raw);
  }

  async setAt(index: number, val: T): Promise<boolean> {
    const encrypted = await encrypt(this.encryptionKey, val);
    return this.backing.setAt(index, encrypted);
  }

  async lengthAsync(): Promise<number> {
    return this.backing.lengthAsync();
  }

  async atAsync(index: number): Promise<T | undefined> {
    const raw = await this.backing.atAsync(index);
    if (raw === undefined) return undefined;
    return decrypt<T>(this.encryptionKey, raw);
  }

  async *entriesAsync(): AsyncIterableIterator<[number, T]> {
    for await (const [i, raw] of this.backing.entriesAsync()) {
      yield [i, await decrypt<T>(this.encryptionKey, raw)];
    }
  }

  async *valuesAsync(): AsyncIterableIterator<T> {
    for await (const raw of this.backing.valuesAsync()) {
      yield decrypt<T>(this.encryptionKey, raw);
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this.valuesAsync();
  }
}

// ---------------------------------------------------------------------------
// EncryptedKVStore
// ---------------------------------------------------------------------------

export class EncryptedKVStore implements AztecAsyncKVStore {
  constructor(
    private readonly backing: AztecAsyncKVStore,
    private readonly encryptionKey: CryptoKey,
  ) {}

  openMap<K extends Key, V extends Value>(name: string): AztecAsyncMap<K, V> {
    return new EncryptedMap<K, V>(this.backing, name, this.encryptionKey) as AztecAsyncMap<K, V>;
  }

  openSet<K extends Key>(name: string): AztecAsyncSet<K> {
    // Sets only store keys, no values to encrypt — delegate directly
    return this.backing.openSet<K>(name);
  }

  openMultiMap<K extends Key, V extends Value>(name: string): AztecAsyncMultiMap<K, V> {
    return new EncryptedMultiMap<K, V>(this.backing, name, this.encryptionKey) as AztecAsyncMultiMap<K, V>;
  }

  openArray<T extends Value>(name: string): AztecAsyncArray<T> {
    return new EncryptedArray<T>(this.backing, name, this.encryptionKey) as AztecAsyncArray<T>;
  }

  openSingleton<T extends Value>(name: string): AztecAsyncSingleton<T> {
    return new EncryptedSingleton<T>(this.backing, name, this.encryptionKey);
  }

  openCounter<K extends Key>(name: string): AztecAsyncCounter<K> {
    // Counters store numbers, not sensitive data — delegate directly
    return this.backing.openCounter<K>(name);
  }

  async transactionAsync<T extends Exclude<any, Promise<any>>>(callback: () => Promise<T>): Promise<T> {
    return this.backing.transactionAsync(callback);
  }

  async clear(): Promise<void> {
    return this.backing.clear();
  }

  async delete(): Promise<void> {
    return this.backing.delete();
  }

  async estimateSize(): Promise<StoreSize> {
    return this.backing.estimateSize();
  }

  async close(): Promise<void> {
    return this.backing.close();
  }

  async backupTo(dstPath: string, compact?: boolean): Promise<void> {
    return this.backing.backupTo(dstPath, compact);
  }
}
