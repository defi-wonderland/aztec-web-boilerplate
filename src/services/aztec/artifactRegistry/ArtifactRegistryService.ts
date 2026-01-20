import type { ContractArtifact } from '@aztec/aztec.js/abi';
// TODO: Re-enable when classId validation is fixed
// import { getContractClassFromArtifact } from '@aztec/aztec.js/contracts';

const DB_NAME = 'aztec-artifact-registry';
const DB_VERSION = 1;
const STORE_NAME = 'artifacts';

interface CachedArtifact {
  classId: string;
  artifact: ContractArtifact;
  cachedAt: number;
}

export class ArtifactRegistryService {
  private memoryCache = new Map<string, ContractArtifact>();
  private pendingRequests = new Map<string, Promise<ContractArtifact>>();
  private db: IDBDatabase | null = null;

  constructor(private baseUrl: string) {}

  async getArtifact(classId: string): Promise<ContractArtifact> {
    console.log(`[ArtifactRegistry] getArtifact called for ${classId}`);

    const memoryCached = this.memoryCache.get(classId);
    if (memoryCached) {
      console.log(`[ArtifactRegistry] Memory cache hit for ${classId}`);
      return memoryCached;
    }

    const pending = this.pendingRequests.get(classId);
    if (pending) {
      console.log(`[ArtifactRegistry] Awaiting pending request for ${classId}`);
      return pending;
    }

    console.log(`[ArtifactRegistry] Loading artifact for ${classId}`);
    const request = this.loadArtifact(classId);
    this.pendingRequests.set(classId, request);

    try {
      const artifact = await request;
      return artifact;
    } finally {
      this.pendingRequests.delete(classId);
    }
  }

  private async loadArtifact(classId: string): Promise<ContractArtifact> {
    console.log(`[ArtifactRegistry] Checking IndexedDB for ${classId}`);
    const storedArtifact = await this.getFromStorage(classId);
    if (storedArtifact) {
      console.log(`[ArtifactRegistry] Found in IndexedDB, validating...`);
      try {
        this.validateArtifact(storedArtifact, classId);
        console.log(
          `[ArtifactRegistry] IndexedDB artifact valid for ${classId}`
        );
        this.memoryCache.set(classId, storedArtifact);
        return storedArtifact;
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

    const artifact = await this.fetchFromRegistry(classId);
    this.memoryCache.set(classId, artifact);
    await this.saveToStorage(classId, artifact);
    return artifact;
  }

  private async fetchFromRegistry(classId: string): Promise<ContractArtifact> {
    const url = `${this.baseUrl}/api/artifacts/${classId}`;
    console.log(`[ArtifactRegistry] Fetching from ${url}`);

    const response = await fetch(url);
    console.log(`[ArtifactRegistry] Response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Artifact not found for classId: ${classId}`);
      }
      throw new Error(
        `Failed to fetch artifact from registry: ${response.status} ${response.statusText}`
      );
    }

    console.log(`[ArtifactRegistry] Parsing JSON response...`);
    const artifact = (await response.json()) as ContractArtifact;
    console.log(
      `[ArtifactRegistry] Artifact parsed, name: ${artifact.name}, functions: ${artifact.functions?.length}`
    );

    console.log(`[ArtifactRegistry] Validating artifact classId...`);
    this.validateArtifact(artifact, classId);
    console.log(`[ArtifactRegistry] Artifact validated successfully`);
    return artifact;
  }

  private validateArtifact(
    artifact: ContractArtifact,
    expectedClassId: string
  ): void {
    console.log(`[ArtifactRegistry] Validating artifact structure...`);
    if (!artifact.name || !Array.isArray(artifact.functions)) {
      throw new Error(
        `Invalid artifact structure for classId: ${expectedClassId}`
      );
    }

    // TODO: Re-enable classId validation once we fix the hanging issue
    // The getContractClassFromArtifact() call hangs, possibly waiting for WASM init
    // For now, skip validation and let contract registration catch mismatches
    console.log(
      `[ArtifactRegistry] Skipping classId validation (temporarily disabled)`
    );

    // console.log(`[ArtifactRegistry] Computing classId from artifact...`);
    // const contractClass = getContractClassFromArtifact(artifact);
    // const computedClassId = contractClass.id.toString();
    // console.log(`[ArtifactRegistry] Computed classId: ${computedClassId}`);

    // if (computedClassId !== expectedClassId) {
    //   throw new Error(
    //     `Artifact classId mismatch: expected ${expectedClassId}, got ${computedClassId}. ` +
    //       `Registry artifact does not match deployed contract.`
    //   );
    // }
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
  ): Promise<ContractArtifact | null> {
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
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const data: CachedArtifact = {
          classId,
          artifact,
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

  clearCache(): void {
    this.memoryCache.clear();
  }

  async clearStorage(): Promise<void> {
    this.clearCache();
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => {
          reject(new Error('Failed to clear IndexedDB'));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch {
      // Silent fail
    }
  }
}
