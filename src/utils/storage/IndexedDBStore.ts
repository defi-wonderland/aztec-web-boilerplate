/**
 * Generic IndexedDB Store
 *
 * A reusable class for IndexedDB CRUD operations that can be used
 * across different features (artifact registry, contract cache, etc.)
 */

import {
  wrapIDBOpen,
  wrapIDBTransaction,
  wrapIDBRequest,
  wrapIDBDelete,
} from '../indexeddb';

/**
 * Configuration for creating an IndexedDB store.
 */
export interface IndexedDBStoreConfig {
  /** Database name */
  dbName: string;
  /** Object store name */
  storeName: string;
  /** Version number for schema migrations */
  version?: number;
  /**
   * Key path for objects stored with auto-key extraction.
   * If provided, the key is extracted from the object itself.
   * If not provided, keys must be passed explicitly to save().
   */
  keyPath?: string;
}

/**
 * Browser API helper - returns IndexedDB factory or null if unavailable.
 */
const getIndexedDB = (): IDBFactory | null =>
  typeof window === 'undefined' ? null : (window.indexedDB ?? null);

/**
 * Generic IndexedDB store for CRUD operations.
 *
 * @template T - The type of values stored
 *
 * @example
 * ```typescript
 * // Key-value store (explicit keys)
 * const cache = new IndexedDBStore<string>({
 *   dbName: 'my-cache',
 *   storeName: 'items',
 * });
 * await cache.save('key1', 'value1');
 * const value = await cache.get('key1');
 *
 * // Object store with keyPath (key extracted from object)
 * const artifacts = new IndexedDBStore<{ id: string; data: unknown }>({
 *   dbName: 'artifacts',
 *   storeName: 'items',
 *   keyPath: 'id',
 * });
 * await artifacts.save('item1', { id: 'item1', data: {} });
 * ```
 */
export class IndexedDBStore<T> {
  private db: IDBDatabase | null = null;
  private readonly config: Required<Omit<IndexedDBStoreConfig, 'keyPath'>> &
    Pick<IndexedDBStoreConfig, 'keyPath'>;

  constructor(config: IndexedDBStoreConfig) {
    this.config = {
      dbName: config.dbName,
      storeName: config.storeName,
      version: config.version ?? 1,
      keyPath: config.keyPath,
    };
  }

  /**
   * Opens the database connection, creating the object store if needed.
   */
  private async openDB(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;

    const indexedDB = getIndexedDB();
    if (!indexedDB) return null;

    const { dbName, storeName, version, keyPath } = this.config;

    this.db = await wrapIDBOpen(indexedDB.open(dbName, version), (db) => {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, keyPath ? { keyPath } : undefined);
      }
    });

    return this.db;
  }

  /**
   * Retrieves a value by key.
   *
   * @param key - The key to look up
   * @returns The value or null if not found/error
   */
  async get(key: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      if (!db) return null;

      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);
      const result = await wrapIDBRequest(store.get(key), null);

      return (result as T | undefined) ?? null;
    } catch (err) {
      console.warn(
        `[IndexedDBStore] Failed to get "${key}" from ${this.config.dbName}:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  /**
   * Saves a value with the given key.
   *
   * @param key - The key to store under (ignored if keyPath is configured)
   * @param value - The value to store
   * @returns true if saved successfully, false otherwise
   */
  async save(key: string, value: T): Promise<boolean> {
    try {
      const db = await this.openDB();
      if (!db) return false;

      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);

      // If keyPath is set, just put the value (key is extracted from object)
      // Otherwise, put with explicit key
      if (this.config.keyPath) {
        store.put(value);
      } else {
        store.put(value, key);
      }

      await wrapIDBTransaction(tx, true, false);
      return true;
    } catch (err) {
      console.warn(
        `[IndexedDBStore] Failed to save "${key}" to ${this.config.dbName}:`,
        err instanceof Error ? err.message : err
      );
      return false;
    }
  }

  /**
   * Deletes a value by key.
   *
   * @param key - The key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      if (!db) return;

      const tx = db.transaction(this.config.storeName, 'readwrite');
      tx.objectStore(this.config.storeName).delete(key);
      await wrapIDBTransaction(tx, undefined, undefined);
    } catch (err) {
      console.warn(
        `[IndexedDBStore] Failed to delete "${key}" from ${this.config.dbName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  /**
   * Clears all data from the object store.
   */
  async clear(): Promise<void> {
    try {
      const db = await this.openDB();
      if (!db) return;

      const tx = db.transaction(this.config.storeName, 'readwrite');
      tx.objectStore(this.config.storeName).clear();
      await wrapIDBTransaction(tx, undefined, undefined);
    } catch (err) {
      console.warn(
        `[IndexedDBStore] Failed to clear ${this.config.dbName}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  /**
   * Deletes the entire database.
   */
  async deleteDatabase(): Promise<void> {
    const indexedDB = getIndexedDB();
    if (!indexedDB) return;

    // Close connection first
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    await wrapIDBDelete(indexedDB.deleteDatabase(this.config.dbName));
  }

  /**
   * Checks if the store is available (browser environment with IndexedDB).
   */
  isAvailable(): boolean {
    return getIndexedDB() !== null;
  }
}

/**
 * Creates an IndexedDB store instance.
 * Factory function for cleaner instantiation.
 */
export function createIndexedDBStore<T>(
  config: IndexedDBStoreConfig
): IndexedDBStore<T> {
  return new IndexedDBStore<T>(config);
}
