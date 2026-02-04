import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';
import {
  ArtifactFetchError,
  ArtifactValidationError,
} from '../../../utils/errors';
import { wrapIDBRequest } from '../../../utils/indexeddb';

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
export function restoreBytecodeBuffers(
  artifact: SerializedArtifact
): ContractArtifact {
  return {
    ...artifact,
    functions: artifact.functions.map((fn) => ({
      ...fn,
      bytecode: restoreBytecode(fn.bytecode),
    })),
  } as ContractArtifact;
}

export type { SerializedArtifact };

/**
 * Serialized artifact for IndexedDB storage.
 * Uses Omit to derive from ContractArtifact, replacing Buffer bytecode with string.
 */
type SerializedArtifact = Omit<ContractArtifact, 'functions'> & {
  functions: Array<
    Omit<ContractArtifact['functions'][number], 'bytecode'> & {
      bytecode: string;
    }
  >;
};

/**
 * Converts bytecode to base64 strings for consistent IndexedDB storage.
 * This avoids serialization issues with Buffer objects across browsers.
 */
function prepareArtifactForStorage(
  artifact: ContractArtifact
): SerializedArtifact {
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
  artifact: SerializedArtifact;
}

export type ArtifactSource = 'memory' | 'indexeddb' | 'network';

export interface ArtifactResult {
  artifact: ContractArtifact;
  source: ArtifactSource;
}

export interface GetArtifactOptions {
  skipValidation?: boolean;
}

export class ArtifactRegistryService {
  private static instances = new Map<string, ArtifactRegistryService>();

  private memoryCache = new Map<string, ContractArtifact>();
  private stringCache = new Map<string, string>();
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

  async getArtifact(
    classId: string,
    options: GetArtifactOptions = {}
  ): Promise<ArtifactResult> {
    const memoryCached = this.memoryCache.get(classId);
    if (memoryCached) {
      return { artifact: memoryCached, source: 'memory' };
    }

    const pending = this.pendingRequests.get(classId);
    if (pending) {
      const result = await pending;
      return { artifact: result.artifact, source: result.source };
    }

    const request = this.loadArtifact(classId, options);
    this.pendingRequests.set(classId, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(classId);
    }
  }

  getStringifiedArtifact(classId: string): string | null {
    return this.stringCache.get(classId) ?? null;
  }

  private async loadArtifact(
    classId: string,
    options: GetArtifactOptions = {}
  ): Promise<ArtifactResult> {
    const { skipValidation = false } = options;

    const storedArtifact = await this.getFromStorage(classId);
    if (storedArtifact) {
      try {
        const restoredArtifact = restoreBytecodeBuffers(storedArtifact);
        if (!skipValidation) {
          await this.validateArtifact(restoredArtifact, classId);
        }
        this.cacheArtifact(classId, restoredArtifact);
        return { artifact: restoredArtifact, source: 'indexeddb' };
      } catch (err) {
        console.warn(
          `[ArtifactRegistry] Cached artifact for ${classId} is invalid, refetching:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const artifact = await this.fetchFromRegistry(classId, options);
    this.cacheArtifact(classId, artifact);
    await this.saveToStorage(classId, artifact);
    return { artifact, source: 'network' };
  }

  private cacheArtifact(classId: string, artifact: ContractArtifact): void {
    this.memoryCache.set(classId, artifact);
    this.stringCache.set(classId, JSON.stringify(artifact));
  }

  private async fetchFromRegistry(
    classId: string,
    options: GetArtifactOptions = {}
  ): Promise<ContractArtifact> {
    const { skipValidation = false } = options;
    const url = `${this.baseUrl}/api/artifacts/${classId}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw ArtifactFetchError.notFound(classId);
      }
      throw ArtifactFetchError.fetchFailed(
        response.status,
        response.statusText
      );
    }

    const rawArtifact = (await response.json()) as SerializedArtifact;
    const artifact = restoreBytecodeBuffers(rawArtifact);
    if (!skipValidation) {
      await this.validateArtifact(artifact, classId);
    }
    return artifact;
  }

  private async validateArtifact(
    artifact: ContractArtifact,
    expectedClassId: string
  ): Promise<void> {
    if (!artifact.name || !Array.isArray(artifact.functions)) {
      throw new ArtifactValidationError(
        `Invalid artifact structure for classId: ${expectedClassId}`
      );
    }

    const contractClass = await getContractClassFromArtifact(artifact);
    const computedClassId = contractClass.id.toString();

    if (computedClassId !== expectedClassId) {
      throw ArtifactValidationError.classIdMismatch(
        expectedClassId,
        computedClassId
      );
    }
  }

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

  private async getFromStorage(
    classId: string
  ): Promise<SerializedArtifact | null> {
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
        `[ArtifactRegistry] Failed to read artifact ${classId} from IndexedDB:`,
        err instanceof Error ? err.message : err
      );
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
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const data: CachedArtifact = {
        classId,
        artifact: storableArtifact,
      };
      await wrapIDBRequest(store.put(data), {
        throw: 'Failed to write to IndexedDB',
      });
    } catch (err) {
      console.warn(
        `[ArtifactRegistry] Failed to save artifact ${classId} to IndexedDB:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
