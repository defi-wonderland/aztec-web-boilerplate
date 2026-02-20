import { DEFAULT_NETWORK } from '../../config/networks/constants';
import { IndexedDBStore } from '../../utils/storage/IndexedDBStore';
import type { CachedContract, ContractsRecord } from './types';

// Separate DBs to avoid IndexedDB version conflicts when stores are created independently
const ARTIFACTS_DB = 'aztec-artifacts';
const CONTRACTS_DB = 'aztec-contracts';
const STORE_NAME = 'data';
const MAX_SAVED_CONTRACTS = 10;

interface ArtifactRecord {
  key: string;
  artifact: string;
}

/**
 * Simple IndexedDB storage for artifacts and contract metadata.
 */
export class ArtifactStorageService {
  private artifacts = new IndexedDBStore<ArtifactRecord>({
    dbName: ARTIFACTS_DB,
    storeName: STORE_NAME,
    keyPath: 'key',
  });

  private contracts = new IndexedDBStore<ContractsRecord>({
    dbName: CONTRACTS_DB,
    storeName: STORE_NAME,
    keyPath: 'network',
  });

  // ===========================================================================
  // Artifacts
  // ===========================================================================

  async get(key: string): Promise<string | null> {
    const record = await this.artifacts.get(key);
    return record?.artifact ?? null;
  }

  async save(key: string, artifact: string): Promise<boolean> {
    return this.artifacts.save(key, { key, artifact });
  }

  async delete(key: string): Promise<void> {
    await this.artifacts.delete(key);
  }

  async clearArtifacts(): Promise<void> {
    await this.artifacts.clear();
  }

  /**
   * Deletes artifacts whose keys start with the given network prefix.
   */
  async clearArtifactsForNetwork(network?: string): Promise<void> {
    const prefix = `${network ?? 'default'}-`;
    const contracts = await this.getContracts(network);

    // Delete artifacts associated with the network's contracts
    await Promise.all(
      contracts
        .filter((c) => c.artifactKey?.startsWith(prefix))
        .map((c) => this.delete(c.artifactKey!))
    );
  }

  // ===========================================================================
  // Contracts
  // ===========================================================================

  async getContracts(network?: string): Promise<CachedContract[]> {
    const record = await this.contracts.get(network ?? DEFAULT_NETWORK);
    return record?.contracts ?? [];
  }

  async saveContracts(
    network: string | undefined,
    contracts: CachedContract[]
  ): Promise<void> {
    const key = network ?? DEFAULT_NETWORK;
    await this.contracts.save(key, {
      network: key,
      contracts: contracts.slice(0, MAX_SAVED_CONTRACTS),
    });
  }

  async clearContracts(network?: string): Promise<void> {
    await this.contracts.delete(network ?? DEFAULT_NETWORK);
  }
}

// Singleton
let instance: ArtifactStorageService | null = null;

export const getArtifactStorageService = (): ArtifactStorageService => {
  if (!instance) {
    instance = new ArtifactStorageService();
  }
  return instance;
};
