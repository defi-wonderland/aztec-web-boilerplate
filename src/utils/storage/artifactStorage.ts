import { wrapIDBRequest } from '../indexeddb';
import type {
  CachedArtifact,
  SerializedArtifact,
} from '../../types/artifactRegistry';

const DB_NAME = 'aztec-artifact-registry';
const DB_VERSION = 1;
const STORE_NAME = 'artifacts';

/**
 * Interface for artifact storage operations.
 * Allows for different storage implementations (IndexedDB, memory, etc.)
 */
export interface IArtifactStorage {
  get(classId: string): Promise<SerializedArtifact | null>;
  save(classId: string, artifact: SerializedArtifact): Promise<void>;
}

/**
 * IndexedDB-based artifact storage implementation.
 */
export class IndexedDBArtifactStorage implements IArtifactStorage {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'classId' });
      }
    };

    this.db = await wrapIDBRequest(request, {
      throw: 'Failed to open IndexedDB',
    });
    return this.db;
  }

  async get(classId: string): Promise<SerializedArtifact | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const result = await wrapIDBRequest<CachedArtifact | undefined>(
        store.get(classId),
        { throw: 'Failed to read from IndexedDB' }
      );
      return result?.artifact ?? null;
    } catch (err) {
      console.warn(
        `[ArtifactStorage] Failed to read artifact ${classId} from IndexedDB:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  async save(classId: string, artifact: SerializedArtifact): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const data: CachedArtifact = {
        classId,
        artifact,
      };
      await wrapIDBRequest(store.put(data), {
        throw: 'Failed to write to IndexedDB',
      });
    } catch (err) {
      console.warn(
        `[ArtifactStorage] Failed to save artifact ${classId} to IndexedDB:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Factory function to create an artifact storage instance.
 */
export function createArtifactStorage(): IArtifactStorage {
  return new IndexedDBArtifactStorage();
}
