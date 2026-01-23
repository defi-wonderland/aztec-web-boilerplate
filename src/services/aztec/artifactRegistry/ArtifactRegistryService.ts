import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';

const DB_NAME = 'aztec-artifact-registry';

interface SerializedBuffer {
  type: 'Buffer';
  data: number[];
}

function isSerializedBuffer(value: unknown): value is SerializedBuffer {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    (value as SerializedBuffer).type === 'Buffer' &&
    'data' in value &&
    Array.isArray((value as SerializedBuffer).data)
  );
}

function restoreBytecode(bytecode: unknown): Buffer {
  if (Buffer.isBuffer(bytecode)) {
    return bytecode;
  }
  if (typeof bytecode === 'string') {
    return Buffer.from(bytecode, 'base64');
  }
  if (bytecode instanceof Uint8Array) {
    return Buffer.from(bytecode);
  }
  if (isSerializedBuffer(bytecode)) {
    return Buffer.from(bytecode.data);
  }
  if (ArrayBuffer.isView(bytecode)) {
    return Buffer.from(
      bytecode.buffer,
      bytecode.byteOffset,
      bytecode.byteLength
    );
  }
  console.error(
    '[ArtifactRegistry] Unknown bytecode format:',
    typeof bytecode,
    bytecode
  );
  throw new Error(`Invalid bytecode format: ${typeof bytecode}`);
}

/**
 * Restores bytecode to Buffer from various formats:
 * - Base64 strings (from registry API or IndexedDB)
 * - Serialized Buffer objects (from IndexedDB: {type: "Buffer", data: [...]})
 * - Uint8Array or other typed arrays
 * - Actual Buffer instances (pass through)
 */
function restoreBytecodeBuffers(artifact: StoredArtifact): ContractArtifact {
  const source = artifact as ContractArtifact;
  return {
    ...source,
    functions: source.functions.map((fn) => ({
      ...fn,
      bytecode: restoreBytecode(fn.bytecode),
    })),
  };
}

/**
 * Artifact stored in IndexedDB with bytecode as base64 strings.
 * This is separate from ContractArtifact to avoid type conflicts.
 */
type StoredArtifact = unknown;

/**
 * Converts bytecode to base64 strings for consistent IndexedDB storage.
 * This avoids serialization issues with Buffer objects across browsers.
 */
function prepareArtifactForStorage(artifact: ContractArtifact): StoredArtifact {
  return {
    ...artifact,
    functions: artifact.functions.map((fn) => ({
      ...fn,
      bytecode: Buffer.isBuffer(fn.bytecode)
        ? fn.bytecode.toString('base64')
        : String(fn.bytecode),
    })),
  };
}

const DB_VERSION = 1;
const STORE_NAME = 'artifacts';

interface CachedArtifact {
  classId: string;
  artifact: StoredArtifact;
  cachedAt: number;
}

export type ArtifactSource = 'memory' | 'indexeddb' | 'network';

export interface ArtifactResult {
  artifact: ContractArtifact;
  source: ArtifactSource;
}

export class ArtifactRegistryService {
  private static instances = new Map<string, ArtifactRegistryService>();

  private memoryCache = new Map<string, ContractArtifact>();
  private pendingRequests = new Map<string, Promise<ArtifactResult>>();
  private db: IDBDatabase | null = null;

  private constructor(private baseUrl: string) {}

  static getInstance(baseUrl: string): ArtifactRegistryService {
    const existing = this.instances.get(baseUrl);
    if (existing) {
      return existing;
    }
    const instance = new ArtifactRegistryService(baseUrl);
    this.instances.set(baseUrl, instance);
    return instance;
  }

  async getArtifact(classId: string): Promise<ArtifactResult> {
    console.log(`[ArtifactRegistry] getArtifact called for ${classId}`);

    const memoryCached = this.memoryCache.get(classId);
    if (memoryCached) {
      console.log(`[ArtifactRegistry] Memory cache hit for ${classId}`);
      return { artifact: memoryCached, source: 'memory' };
    }

    const pending = this.pendingRequests.get(classId);
    if (pending) {
      console.log(`[ArtifactRegistry] Awaiting pending request for ${classId}`);
      const result = await pending;
      return { artifact: result.artifact, source: result.source };
    }

    console.log(`[ArtifactRegistry] Loading artifact for ${classId}`);
    const request = this.loadArtifact(classId);
    this.pendingRequests.set(classId, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(classId);
    }
  }

  private async loadArtifact(classId: string): Promise<ArtifactResult> {
    console.log(`[ArtifactRegistry] Checking IndexedDB for ${classId}`);
    const storedArtifact = await this.getFromStorage(classId);
    if (storedArtifact) {
      const stored = storedArtifact as ContractArtifact;
      const firstBytecode = stored.functions?.[0]?.bytecode;
      console.log(`[ArtifactRegistry] Found in IndexedDB, bytecode type:`, {
        type: typeof firstBytecode,
        isBuffer: Buffer.isBuffer(firstBytecode),
        isUint8Array: firstBytecode instanceof Uint8Array,
        constructor: (firstBytecode as object)?.constructor?.name,
      });
      try {
        const restoredArtifact = restoreBytecodeBuffers(storedArtifact);
        await this.validateArtifact(restoredArtifact, classId);
        console.log(
          `[ArtifactRegistry] IndexedDB artifact valid for ${classId}`
        );
        this.memoryCache.set(classId, restoredArtifact);
        return { artifact: restoredArtifact, source: 'indexeddb' };
      } catch (err) {
        console.warn(
          `[ArtifactRegistry] Cached artifact for ${classId} is invalid, refetching:`,
          err instanceof Error ? err.message : err
        );
      }
    } else {
      console.log(
        `[ArtifactRegistry] Not in IndexedDB, fetching from registry`
      );
    }

    console.log(`[ArtifactRegistry] Fetching ${classId} from network...`);
    const artifact = await this.fetchFromRegistry(classId);
    this.memoryCache.set(classId, artifact);
    await this.saveToStorage(classId, artifact);
    return { artifact, source: 'network' };
  }

  private async fetchFromRegistry(classId: string): Promise<ContractArtifact> {
    const url = `${this.baseUrl}/api/artifacts/${classId}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Artifact not found for classId: ${classId}`);
      }
      throw new Error(
        `Failed to fetch artifact from registry: ${response.status} ${response.statusText}`
      );
    }

    const rawArtifact = (await response.json()) as ContractArtifact;
    const artifact = restoreBytecodeBuffers(rawArtifact);
    await this.validateArtifact(artifact, classId);
    return artifact;
  }

  private async validateArtifact(
    artifact: ContractArtifact,
    expectedClassId: string
  ): Promise<void> {
    if (!artifact.name || !Array.isArray(artifact.functions)) {
      throw new Error(
        `Invalid artifact structure for classId: ${expectedClassId}`
      );
    }

    const contractClass = await getContractClassFromArtifact(artifact);
    const computedClassId = contractClass.id.toString();

    if (computedClassId !== expectedClassId) {
      throw new Error(
        `Artifact classId mismatch: expected ${expectedClassId}, got ${computedClassId}. ` +
          `Registry artifact does not match deployed contract.`
      );
    }
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'classId' });
        }
      };
    });
  }

  private async getFromStorage(
    classId: string
  ): Promise<StoredArtifact | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(classId);

        request.onerror = () => {
          reject(new Error('Failed to read from IndexedDB'));
        };

        request.onsuccess = () => {
          const result = request.result as CachedArtifact | undefined;
          resolve(result?.artifact ?? null);
        };
      });
    } catch {
      return null;
    }
  }

  private async saveToStorage(
    classId: string,
    artifact: ContractArtifact
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const storableArtifact = prepareArtifactForStorage(artifact);
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const data: CachedArtifact = {
          classId,
          artifact: storableArtifact,
          cachedAt: Date.now(),
        };
        const request = store.put(data);

        request.onerror = () => {
          reject(new Error('Failed to write to IndexedDB'));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch {
      // Silent fail for storage - not critical
    }
  }
}
