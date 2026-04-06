import type {
  AztecAsyncKVStore,
  AztecAsyncMap,
  AztecAsyncSet,
  AztecAsyncMultiMap,
  AztecAsyncArray,
  AztecAsyncSingleton,
  AztecAsyncCounter,
  Key,
  Value,
  StoreSize,
} from '@aztec/kv-store/interfaces';

export class CompositeKVStore implements AztecAsyncKVStore {
  constructor(
    private persistent: AztecAsyncKVStore,
    private ephemeral: AztecAsyncKVStore,
    private ephemeralNames: Set<string>
  ) {}

  private route(name: string): AztecAsyncKVStore {
    return this.ephemeralNames.has(name) ? this.ephemeral : this.persistent;
  }

  openMap<K extends Key, V extends Value>(name: string): AztecAsyncMap<K, V> {
    return this.route(name).openMap<K, V>(name);
  }

  openSet<K extends Key>(name: string): AztecAsyncSet<K> {
    return this.route(name).openSet<K>(name);
  }

  openMultiMap<K extends Key, V extends Value>(
    name: string
  ): AztecAsyncMultiMap<K, V> {
    return this.route(name).openMultiMap<K, V>(name);
  }

  openArray<T extends Value>(name: string): AztecAsyncArray<T> {
    return this.route(name).openArray<T>(name);
  }

  openSingleton<T extends Value>(name: string): AztecAsyncSingleton<T> {
    return this.route(name).openSingleton<T>(name);
  }

  openCounter<K extends Key>(name: string): AztecAsyncCounter<K> {
    return this.route(name).openCounter<K>(name);
  }

  async transactionAsync<T>(callback: () => Promise<T>): Promise<T> {
    return this.persistent.transactionAsync(callback);
  }

  async clear(): Promise<void> {
    await Promise.all([this.persistent.clear(), this.ephemeral.clear()]);
  }

  async delete(): Promise<void> {
    await Promise.all([this.persistent.delete(), this.ephemeral.delete()]);
  }

  async estimateSize(): Promise<StoreSize> {
    const [p, e] = await Promise.all([
      this.persistent.estimateSize(),
      this.ephemeral.estimateSize(),
    ]);
    return {
      mappingSize: p.mappingSize + e.mappingSize,
      physicalFileSize: p.physicalFileSize + e.physicalFileSize,
      actualSize: p.actualSize + e.actualSize,
      numItems: p.numItems + e.numItems,
    };
  }

  async close(): Promise<void> {
    await Promise.all([this.persistent.close(), this.ephemeral.close()]);
  }

  async backupTo(dstPath: string, compact?: boolean): Promise<void> {
    await this.persistent.backupTo(dstPath, compact);
  }
}
