import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  ContractInstanceWithAddress,
  getContractInstanceFromInstantiationParams,
} from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { createLogger } from '@aztec/aztec.js/log';
import type { PXE } from '@aztec/pxe/server';
import type { ContractArtifact } from '@aztec/stdlib/abi';
import type {
  ContractConfigMap,
  ContractDeployParams,
  ContractNames,
  ContractStatus,
  IContractRegistry,
  RegisteredContract,
} from './types';
import type { NetworkDeployments } from '../config/deployments/types';
import type { ResolvedArtifacts } from '../services/aztec/artifact';

const logger = createLogger('contract-registry');

/**
 * Contract Registry Service
 *
 * Manages contract registration with PXE using:
 * - Contract configs (what the contract is: artifact, constructor, sources)
 * - Deployment data (where it's deployed: address, salt, deployer)
 *
 * @example
 * ```typescript
 * const registry = new ContractRegistry(pxe, contracts, deployments, artifacts);
 *
 * await registry.registerAll();
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
    private readonly deployments: NetworkDeployments,
    private readonly artifacts: ResolvedArtifacts
  ) {
    logger.info('ContractRegistry initialized', {
      contracts: Object.keys(contracts),
    });
  }

  /** Get the resolved artifact for a contract, or throw if missing */
  private getArtifact(name: ContractNames<T>): ContractArtifact {
    const artifact = this.artifacts[name as string];
    if (!artifact) {
      throw new Error(
        `No resolved artifact for contract "${String(name)}". ` +
          `Ensure artifact sources are configured.`
      );
    }
    return artifact;
  }

  /** Resolve constructor args (static array or function receiving contract deployments) */
  private resolveConstructorArgs(config: T[ContractNames<T>]): unknown[] {
    return typeof config.constructorArgs === 'function'
      ? config.constructorArgs(this.deployments)
      : config.constructorArgs;
  }

  /** Build ContractDeployParams by merging contract config + deployment data */
  private buildDeployParams(
    name: ContractNames<T>,
    config: T[ContractNames<T>]
  ): ContractDeployParams {
    const deployment = this.deployments[name as string];
    if (!deployment) {
      throw new Error(
        `No deployment data for contract "${String(name)}". ` +
          `Add it to the deployment file for this network.`
      );
    }

    if (!deployment.salt) {
      throw new Error(
        `Missing "salt" in deployment data for contract "${String(name)}".`
      );
    }
    if (!deployment.deployer) {
      throw new Error(
        `Missing "deployer" in deployment data for contract "${String(name)}".`
      );
    }

    return {
      salt: Fr.fromString(deployment.salt),
      deployer: AztecAddress.fromString(deployment.deployer),
      constructorArgs: this.resolveConstructorArgs(config),
      constructorArtifact: config.constructorArtifact,
    };
  }

  /** Get the expected address for a contract from deployment data */
  private getExpectedAddress(name: ContractNames<T>): AztecAddress {
    const deployment = this.deployments[name as string];
    if (!deployment) {
      throw new Error(`No deployment data for contract "${String(name)}".`);
    }
    if (!deployment.address) {
      throw new Error(
        `Missing "address" in deployment data for contract "${String(name)}".`
      );
    }
    const address = AztecAddress.fromString(deployment.address);
    if (address.isZero()) {
      throw new Error(
        `Contract "${String(name)}" has a zero address, which indicates it has not been deployed yet.`
      );
    }
    return address;
  }

  isRegistered(name: ContractNames<T>): boolean {
    const entry = this.cache.get(name);
    return entry?.status === 'ready';
  }

  getInstance(name: ContractNames<T>): ContractInstanceWithAddress | null {
    const entry = this.cache.get(name);
    return entry?.status === 'ready' ? entry.instance : null;
  }

  getStatus(name: ContractNames<T>): ContractStatus {
    return this.cache.get(name)?.status ?? 'idle';
  }

  getRegisteredNames(): ContractNames<T>[] {
    return Array.from(this.cache.entries())
      .filter(([, entry]) => entry.status === 'ready')
      .map(([name]) => name);
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async register(name: ContractNames<T>): Promise<void> {
    if (this.isRegistered(name)) {
      logger.info(`Contract "${String(name)}" - MEMORY CACHE HIT`);
      return;
    }

    const pending = this.pendingRegistrations.get(name);
    if (pending) {
      logger.info(
        `Contract "${String(name)}" - AWAITING (registration in progress)`
      );
      return pending;
    }

    await this.syncFromStorage([name]);
    if (this.isRegistered(name)) {
      return;
    }

    const registrationPromise = this.performRegistration(name);
    this.pendingRegistrations.set(name, registrationPromise);

    try {
      await registrationPromise;
    } finally {
      this.pendingRegistrations.delete(name);
    }
  }

  async registerAll(names?: ContractNames<T>[]): Promise<void> {
    const contractNames =
      names ?? (Object.keys(this.contracts) as ContractNames<T>[]);

    if (contractNames.length === 0) {
      return;
    }

    await this.syncFromStorage(contractNames);

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

  private async syncFromStorage(names: ContractNames<T>[]): Promise<void> {
    logger.debug(
      `Checking storage for ${names.length} contracts: [${names.map(String).join(', ')}]`
    );

    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );

    let syncedCount = 0;

    for (const name of names) {
      if (this.isRegistered(name)) {
        syncedCount++;
        continue;
      }

      const contractConfig = this.contracts[name];
      if (!contractConfig) {
        continue;
      }

      try {
        const expectedAddress = this.getExpectedAddress(name);
        const isInStorage = await this.isRegisteredInStorage(expectedAddress);

        if (isInStorage) {
          const artifact = this.getArtifact(name);
          const deployParams = this.buildDeployParams(name, contractConfig);
          const instance = await getContractInstanceFromInstantiationParams(
            artifact,
            {
              salt: deployParams.salt,
              deployer: deployParams.deployer,
              constructorArgs: deployParams.constructorArgs,
              constructorArtifact: deployParams.constructorArtifact,
            }
          );

          if (!instance.address.equals(expectedAddress)) {
            throw new Error(
              `Contract "${String(name)}" storage address mismatch! ` +
                `Computed: ${instance.address.toString()}, ` +
                `Expected: ${expectedAddress.toString()}`
            );
          }

          this.updateCache(name, { status: 'ready', instance });
          syncedCount++;
          logger.info(`Contract "${String(name)}" - STORAGE HIT (IndexedDB)`);
        }
      } catch (err) {
        // Re-throw address mismatches — these indicate a config/storage
        // inconsistency that must not silently fall through to fresh registration.
        if (
          err instanceof Error &&
          err.message.includes('storage address mismatch')
        ) {
          throw err;
        }
        // Contract not in storage - will be registered fresh
      }
    }

    if (syncedCount > 0) {
      this.notifySubscribers();
    }
  }

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
      const expectedAddress = this.getExpectedAddress(name);
      const instance = await this.registerInstanceWithPXE(name, contractConfig);

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
        `Contract "${String(name)}" - FRESH REGISTRATION at ${instance.address.toString()}`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateCache(name, {
        status: 'error',
        instance: null as unknown as ContractInstanceWithAddress,
        error: err,
      });
      this.notifySubscribers();

      logger.error(`Contract "${String(name)}" - REGISTRATION FAILED`, err);
      throw err;
    }
  }

  private async isRegisteredInStorage(address: AztecAddress): Promise<boolean> {
    try {
      const instance = await this.pxe.getContractInstance(address);
      return instance !== undefined;
    } catch {
      return false;
    }
  }

  private async registerInstanceWithPXE(
    name: ContractNames<T>,
    contractConfig: T[ContractNames<T>]
  ): Promise<ContractInstanceWithAddress> {
    const artifact = this.getArtifact(name);
    const deployParams = this.buildDeployParams(name, contractConfig);

    const instance = await getContractInstanceFromInstantiationParams(
      artifact,
      {
        salt: deployParams.salt,
        deployer: deployParams.deployer,
        constructorArgs: deployParams.constructorArgs,
        constructorArtifact: deployParams.constructorArtifact,
      }
    );

    await this.pxe.registerContract({
      instance,
      artifact,
    });

    return instance;
  }

  private updateCache(name: ContractNames<T>, entry: RegisteredContract): void {
    this.cache.set(name, entry);
  }

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
