import { IndexedDBStore } from './IndexedDBStore';
import type {
  CachedArtifact,
  SerializedArtifact,
} from '../../types/artifactRegistry';

const DB_NAME = 'aztec-artifact-registry';
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
 * Uses the generic IndexedDBStore for underlying operations.
 */
export class IndexedDBArtifactStorage implements IArtifactStorage {
  private store = new IndexedDBStore<CachedArtifact>({
    dbName: DB_NAME,
    storeName: STORE_NAME,
    keyPath: 'classId',
  });

  async get(classId: string): Promise<SerializedArtifact | null> {
    const result = await this.store.get(classId);
    return result?.artifact ?? null;
  }

  async save(classId: string, artifact: SerializedArtifact): Promise<void> {
    const data: CachedArtifact = { classId, artifact };
    await this.store.save(classId, data);
  }
}

/**
 * Factory function to create an artifact storage instance.
 */
export function createArtifactStorage(): IArtifactStorage {
  return new IndexedDBArtifactStorage();
}
