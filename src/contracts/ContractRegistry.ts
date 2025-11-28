import {
  AztecAddress,
  ContractInstanceWithAddress,
  type PXE,
} from '@aztec/aztec.js';
import { createLogger } from '@aztec/foundation/log';
import type { AppConfig } from '../config/networks';
import type {
  ContractConfigMap,
  ContractNames,
  ContractStatus,
  IContractRegistry,
  RegisteredContract,
} from './types';

const logger = createLogger('contract-registry');

/**
 * Contract Registry Service
 * 
 * Manages contract registration with PXE, featuring:
 * - Smart PXE persistence checks (skip re-registration if already in PXE)
 * - Local caching of registered contracts
 * - Concurrent request deduplication
 * - Subscription support for status changes
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
 * await registry.ensureRegistered('dripper');
 * 
 * // Get instance
 * const instance = registry.getInstance('dripper');
 * ```
 */
export class ContractRegistry<T extends ContractConfigMap>
  implements IContractRegistry<T>
{
  private cache: Map<ContractNames<T>, RegisteredContract> = new Map();
  private pendingRegistrations: Map<ContractNames<T>, Promise<void>> = new Map();
  private subscribers: Set<() => void> = new Set();

  constructor(
    private readonly pxe: PXE,
    private readonly contracts: T,
    private readonly config: AppConfig
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
   * If already registered (in cache or PXE), this is a no-op.
   * Handles concurrent requests by deduplicating in-flight registrations.
   */
  async ensureRegistered(name: ContractNames<T>): Promise<void> {
    // Check local cache first
    if (this.isRegistered(name)) {
      logger.debug(`Contract "${name}" already registered (cache hit)`);
      return;
    }

    // Check if registration is already in progress
    const pending = this.pendingRegistrations.get(name);
    if (pending) {
      logger.debug(`Contract "${name}" registration in progress, awaiting...`);
      return pending;
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
   * Register multiple contracts in parallel.
   * If no names provided, registers all contracts in the config.
   */
  async registerAll(names?: ContractNames<T>[]): Promise<void> {
    const contractNames = names ?? (Object.keys(this.contracts) as ContractNames<T>[]);
    
    logger.info(`Registering ${contractNames.length} contracts...`, { contracts: contractNames });
    
    await Promise.all(
      contractNames.map((name) => this.ensureRegistered(name))
    );
    
    logger.info('All contracts registered successfully');
  }

  /**
   * Internal: Perform the actual registration with PXE
   */
  private async performRegistration(name: ContractNames<T>): Promise<void> {
    const contractConfig = this.contracts[name];
    if (!contractConfig) {
      throw new Error(`Unknown contract: "${name}"`);
    }

    // Update status to checking
    this.updateCache(name, { status: 'checking', instance: null as unknown as ContractInstanceWithAddress });
    this.notifySubscribers();

    try {
      // Get the expected address
      const expectedAddress = AztecAddress.fromString(
        contractConfig.address(this.config)
      );

      // Check if already registered in PXE
      const isInPXE = await this.isRegisteredInPXE(expectedAddress);
      
      if (isInPXE) {
        logger.info(`Contract "${name}" already in PXE, skipping registration`);
        // Get the instance from PXE to store in cache
        const instance = await this.getInstanceFromPXE(name, expectedAddress);
        this.updateCache(name, { status: 'ready', instance });
        this.notifySubscribers();
        return;
      }

      // Update status to registering
      this.updateCache(name, { status: 'registering', instance: null as unknown as ContractInstanceWithAddress });
      this.notifySubscribers();

      // Compute instance and register
      const instance = await this.computeAndRegister(name, contractConfig);
      
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
      
      logger.info(`Contract "${name}" registered successfully at ${instance.address.toString()}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateCache(name, { 
        status: 'error', 
        instance: null as unknown as ContractInstanceWithAddress,
        error: err 
      });
      this.notifySubscribers();
      
      logger.error(`Failed to register contract "${name}"`, err);
      throw err;
    }
  }

  /**
   * Check if a contract is already registered in PXE
   */
  private async isRegisteredInPXE(address: AztecAddress): Promise<boolean> {
    try {
      const metadata = await this.pxe.getContractMetadata(address);
      return metadata !== undefined && metadata.contractInstance !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get contract instance from PXE (when already registered)
   */
  private async getInstanceFromPXE(
    name: ContractNames<T>,
    address: AztecAddress
  ): Promise<ContractInstanceWithAddress> {
    const contractConfig = this.contracts[name];
    const deployParams = contractConfig.deployParams(this.config);

    // Compute the instance to get full details
    const { getContractInstanceFromInstantiationParams } = await import('@aztec/aztec.js');
    
    const instance = await getContractInstanceFromInstantiationParams(
      contractConfig.artifact,
      {
        salt: deployParams.salt,
        deployer: deployParams.deployer,
        constructorArgs: deployParams.constructorArgs,
        constructorArtifact: deployParams.constructorArtifact,
      }
    );

    if (!instance.address.equals(address)) {
      throw new Error(
        `Contract "${name}" instance address mismatch when retrieving from PXE`
      );
    }

    return instance;
  }

  /**
   * Compute contract instance and register with PXE
   */
  private async computeAndRegister(
    name: ContractNames<T>,
    contractConfig: T[ContractNames<T>]
  ): Promise<ContractInstanceWithAddress> {
    const deployParams = contractConfig.deployParams(this.config);

    const { getContractInstanceFromInstantiationParams } = await import('@aztec/aztec.js');
    
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
  private updateCache(
    name: ContractNames<T>,
    entry: RegisteredContract
  ): void {
    this.cache.set(name, entry);
  }

  /**
   * Notify all subscribers of a change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback());
  }
}


