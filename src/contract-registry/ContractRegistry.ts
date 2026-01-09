import { AztecAddress } from '@aztec/aztec.js/addresses';
import { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import { createLogger } from '@aztec/foundation/log';
import type { PXE } from '@aztec/pxe/server';
import type {
  ContractConfigMap,
  ContractNames,
  ContractStatus,
  ContractClass,
  IContractRegistry,
  RegisteredContract,
} from './types';
import type { NetworkConfig } from '../config/networks';

const logger = createLogger('contract-registry');

/**
 * Contract Registry Service
 *
 * Manages contract registration with PXE, featuring:
 *
 * @example
 * ```typescript
 * const registry = new ContractRegistry(pxe, contracts, config);
 *
 * // Register all contracts
 * await registry.registerAll();
 *
 * // Or register specific contracts
 * await registry.registerAll(['dripper', 'token']);
 *
 * // Lazy registration
 * await registry.register('dripper');
 *
 * // Get instance
 * const instance = registry.getInstance('dripper');
 * ```
 */
export class ContractRegistry<T extends ContractConfigMap>
  implements IContractRegistry<T>
{
  private cache: Map<ContractNames<T>, RegisteredContract> = new Map();
  private pendingRegistrations: Map<ContractNames<T>, Promise<void>> =
    new Map();
  private subscribers: Set<() => void> = new Set();

  constructor(
    private readonly pxe: PXE,
    private readonly contracts: T,
    private readonly config: NetworkConfig
  ) {
    logger.info('ContractRegistry initialized', {
      contracts: Object.keys(contracts),
    });
  }

  /**
   * Check if a contract is registered and ready in the local cache
   */
  isRegistered(name: ContractNames<T>): boolean {
    const entry = this.cache.get(name);
    return entry?.status === 'ready';
  }

  /**
   * Get the instance of a registered contract
   */
  getInstance(name: ContractNames<T>): ContractInstanceWithAddress | null {
    const entry = this.cache.get(name);
    return entry?.status === 'ready' ? entry.instance : null;
  }

  /**
   * Get the current status of a contract
   */
  getStatus(name: ContractNames<T>): ContractStatus {
    return this.cache.get(name)?.status ?? 'idle';
  }

  /**
   * Get the contract class for creating callable instances
   */
  getContractClass(name: ContractNames<T>): ContractClass | null {
    const contractConfig = this.contracts[name];
    if (!contractConfig) {
      return null;
    }
    return contractConfig.contract;
  }

  /**
   * Get all registered contract names
   */
  getRegisteredNames(): ContractNames<T>[] {
    return Array.from(this.cache.entries())
      .filter(([, entry]) => entry.status === 'ready')
      .map(([name]) => name);
  }

  /**
   * Subscribe to registry changes
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Ensure a contract is registered with PXE.
   * Checks memory cache first, then storage, before registering fresh.
   * Handles concurrent requests by deduplicating in-flight registrations.
   */
  async register(name: ContractNames<T>): Promise<void> {
    if (this.isRegistered(name)) {
      logger.info(`📦 Contract "${String(name)}" - MEMORY CACHE HIT`);
      return;
    }

    // Check if registration is already in progress
    const pending = this.pendingRegistrations.get(name);
    if (pending) {
      logger.info(
        `⏳ Contract "${String(name)}" - AWAITING (registration in progress)`
      );
      return pending;
    }

    // Check storage before registering (avoid re-registration after page refresh)
    await this.syncFromStorage([name]);
    if (this.isRegistered(name)) {
      return;
    }

    // Start new registration
    const registrationPromise = this.performRegistration(name);
    this.pendingRegistrations.set(name, registrationPromise);

    try {
      await registrationPromise;
    } finally {
      this.pendingRegistrations.delete(name);
    }
  }

  /**
   * Ensure multiple contracts are registered and ready.
   *
   * This method handles the full registration flow:
   * 1. First syncs from storage (checks which contracts are already in PXE's IndexedDB)
   * 2. Then registers any contracts not found in storage
   *
   * If no names provided, processes all contracts in the config.
   */
  async registerAll(names?: ContractNames<T>[]): Promise<void> {
    const contractNames =
      names ?? (Object.keys(this.contracts) as ContractNames<T>[]);

    if (contractNames.length === 0) {
      return;
    }

    // 1. Sync from storage first (mark already-registered contracts as ready)
    await this.syncFromStorage(contractNames);

    // 2. Register any contracts still not ready
    const toRegister = contractNames.filter((name) => !this.isRegistered(name));

    if (toRegister.length === 0) {
      logger.info('All contracts already registered (found in storage)');
      return;
    }

    logger.info(`Registering ${toRegister.length} new contracts...`, {
      contracts: toRegister,
    });

    for (const name of toRegister) {
      await this.register(name);
    }

    logger.info('All contracts registered successfully');
  }

  /**
   * Sync memory cache from PXE's persistent storage (IndexedDB).
   * Checks which contracts are already registered and marks them as ready.
   * This avoids re-registering contracts that persist across page refreshes.
   */
  private async syncFromStorage(names: ContractNames<T>[]): Promise<void> {
    logger.debug(
      `🔍 Checking storage for ${names.length} contracts: [${names.map(String).join(', ')}]`
    );

    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );

    let syncedCount = 0;

    for (const name of names) {
      // Skip if already in memory cache
      if (this.isRegistered(name)) {
        syncedCount++;
        continue;
      }

      const contractConfig = this.contracts[name];
      if (!contractConfig) {
        continue;
      }

      try {
        const expectedAddress = AztecAddress.fromString(
          contractConfig.address(this.config)
        );

        const isInStorage = await this.isRegisteredInStorage(expectedAddress);

        if (isInStorage) {
          const deployParams = contractConfig.deployParams(this.config);
          const instance = await getContractInstanceFromInstantiationParams(
            contractConfig.artifact,
            {
              salt: deployParams.salt,
              deployer: deployParams.deployer,
              constructorArgs: deployParams.constructorArgs,
              constructorArtifact: deployParams.constructorArtifact,
            }
          );

          this.updateCache(name, { status: 'ready', instance });
          syncedCount++;
          logger.info(
            `💾 Contract "${String(name)}" - STORAGE HIT (IndexedDB)`
          );
        }
      } catch {
        // Contract not in storage - will be registered fresh
      }
    }

    if (syncedCount > 0) {
      this.notifySubscribers();
    }
  }

  /**
   * Internal: Perform the actual registration with PXE.
   * At this point, we know the contract is NOT in memory cache.
   */
  private async performRegistration(name: ContractNames<T>): Promise<void> {
    const contractConfig = this.contracts[name];
    if (!contractConfig) {
      throw new Error(`Unknown contract: "${name}"`);
    }

    this.updateCache(name, {
      status: 'registering',
      instance: null as unknown as ContractInstanceWithAddress,
    });
    this.notifySubscribers();

    try {
      const expectedAddress = AztecAddress.fromString(
        contractConfig.address(this.config)
      );

      const instance = await this.registerInstanceWithPXE(name, contractConfig);

      // Validate address matches expected
      if (!instance.address.equals(expectedAddress)) {
        throw new Error(
          `Contract "${name}" address mismatch! ` +
            `Computed: ${instance.address.toString()}, ` +
            `Expected: ${expectedAddress.toString()}`
        );
      }

      this.updateCache(name, { status: 'ready', instance });
      this.notifySubscribers();

      logger.info(
        `🆕 Contract "${String(name)}" - FRESH REGISTRATION at ${instance.address.toString()}`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateCache(name, {
        status: 'error',
        instance: null as unknown as ContractInstanceWithAddress,
        error: err,
      });
      this.notifySubscribers();

      logger.error(`❌ Contract "${String(name)}" - REGISTRATION FAILED`, err);
      throw err;
    }
  }

  /**
   * Check if a contract is already registered in PXE's storage (IndexedDB)
   */
  private async isRegisteredInStorage(address: AztecAddress): Promise<boolean> {
    try {
      const instance = await this.pxe.getContractInstance(address);
      return instance !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Create contract instance from deploy params and register with PXE
   */
  private async registerInstanceWithPXE(
    name: ContractNames<T>,
    contractConfig: T[ContractNames<T>]
  ): Promise<ContractInstanceWithAddress> {
    const deployParams = contractConfig.deployParams(this.config);

    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );

    const instance = await getContractInstanceFromInstantiationParams(
      contractConfig.artifact,
      {
        salt: deployParams.salt,
        deployer: deployParams.deployer,
        constructorArgs: deployParams.constructorArgs,
        constructorArtifact: deployParams.constructorArtifact,
      }
    );

    await this.pxe.registerContract({
      instance,
      artifact: contractConfig.artifact,
    });

    return instance;
  }

  /**
   * Update the cache entry for a contract
   */
  private updateCache(name: ContractNames<T>, entry: RegisteredContract): void {
    this.cache.set(name, entry);
  }

  /**
   * Notify all subscribers of a change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback());
  }

  clearCache(): void {
    this.cache.clear();
    this.pendingRegistrations.clear();
    this.notifySubscribers();
    logger.info('Memory cache cleared');
  }
}
