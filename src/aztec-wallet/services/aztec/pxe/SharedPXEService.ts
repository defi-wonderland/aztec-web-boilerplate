import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createLogger } from '@aztec/aztec.js/log';
import type { AztecNode } from '@aztec/aztec.js/node';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { createStore } from '@aztec/kv-store/indexeddb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { createPXE } from '@aztec/pxe/client/bundle';
import { getPXEConfig } from '@aztec/pxe/config';
import type { PXE } from '@aztec/pxe/server';
import { AVAILABLE_NETWORKS } from '../../../../config/networks';
import { FeePaymentRegister } from '../../../../services/aztec/feePayment/FeePaymentRegister';
import { MinimalWallet } from '../../../../utils/MinimalWallet';
import { getNetworkDeployments } from '../../../../utils/deployments';
import { NetworkService } from '../network';
import { AztecStorageService } from '../storage';
import type { AztecNetwork } from '../../../../types/network';

const logger = createLogger('shared-pxe-service');
const pxeLogger = createLogger('pxe');
const getProverEnabled = (networkName: AztecNetwork): boolean => {
  const networkConfig = AVAILABLE_NETWORKS.find((n) => n.name === networkName);
  if (!networkConfig) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }
  return networkConfig.proverEnabled;
};

export interface SharedPXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  wallet: MinimalWallet;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

interface PXEInstanceEntry {
  instance: SharedPXEInstance;
  nodeUrl: string;
  networkName: AztecNetwork;
}

/**
 * SharedPXEService manages PXE instances across the application.
 * Uses singleton pattern with lazy initialization.
 */
class SharedPXEServiceClass {
  private instances: Map<string, PXEInstanceEntry> = new Map();
  private initPromises: Map<string, Promise<SharedPXEInstance>> = new Map();
  private cachedPaymentMethods: Map<string, SponsoredFeePaymentMethod> =
    new Map();
  private storePromises: Map<
    string,
    Promise<Awaited<ReturnType<typeof createStore>>>
  > = new Map();
  private static readonly PERSISTED_STORE_KB = 5e5; // 500MB
  private static readonly FALLBACK_STORE_KB = 1e5; // 100MB

  /**
   * Get or create a PXE instance for a specific network.
   * Deduplicates concurrent callers — all get the same promise.
   */
  async getInstance(
    nodeUrl: string,
    networkName: AztecNetwork
  ): Promise<SharedPXEInstance> {
    const normalizedNodeUrl = this.normalizeNodeUrl(nodeUrl);
    const key = this.getInstanceKey(networkName);

    // Return existing instance if available
    const existing = this.instances.get(key);
    if (existing) {
      return existing.instance;
    }

    // Deduplicate concurrent initializations
    const pending = this.initPromises.get(key);
    if (pending) {
      return pending;
    }

    // Start new initialization
    const promise = this.initializeInstance(
      normalizedNodeUrl,
      networkName,
      key
    );
    this.initPromises.set(key, promise);

    try {
      return await promise;
    } finally {
      this.initPromises.delete(key);
    }
  }

  /**
   * Check if a PXE instance is initialized for a network
   */
  isInitialized(networkName: AztecNetwork): boolean {
    const key = this.getInstanceKey(networkName);
    return this.instances.has(key);
  }

  /**
   * Check if initialization is in progress for a network
   */
  isInitializing(networkName: AztecNetwork): boolean {
    const key = this.getInstanceKey(networkName);
    return this.initPromises.has(key);
  }

  /**
   * Get existing instance without initialization (returns null if not initialized)
   */
  getExistingInstance(networkName: AztecNetwork): SharedPXEInstance | null {
    const key = this.getInstanceKey(networkName);
    return this.instances.get(key)?.instance ?? null;
  }

  /**
   * Clear and tear down a specific PXE instance (useful for network switching).
   * Stops the PXE and closes the IndexedDB store to release resources.
   */
  async clearInstance(networkName: AztecNetwork): Promise<void> {
    const key = this.getInstanceKey(networkName);
    const entry = this.instances.get(key);

    this.instances.delete(key);
    this.cachedPaymentMethods.delete(key);
    this.storePromises.delete(networkName);

    if (entry) {
      await this.teardownInstance(entry.instance);
      NetworkService.clearClient(entry.nodeUrl);
    }

    logger.info(`Cleared PXE instance for ${networkName}`);
  }

  /**
   * Clear and tear down all PXE instances.
   */
  async clearAll(): Promise<void> {
    const entries = Array.from(this.instances.values());

    this.instances.clear();
    this.cachedPaymentMethods.clear();
    this.storePromises.clear();

    await Promise.allSettled(
      entries.map((entry) => this.teardownInstance(entry.instance))
    );

    NetworkService.clearAll();

    logger.info('Cleared all PXE instances');
  }

  private async teardownInstance(instance: SharedPXEInstance): Promise<void> {
    try {
      await instance.pxe.stop();
    } catch (err) {
      logger.warn('Failed to stop PXE instance', { err });
    }
  }

  private getInstanceKey(networkName: AztecNetwork | string): string {
    return `${networkName}`;
  }

  private normalizeNodeUrl(nodeUrl: string): string {
    if (!nodeUrl) {
      return nodeUrl;
    }
    return nodeUrl.endsWith('/') ? nodeUrl.slice(0, -1) : nodeUrl;
  }

  private async initializeInstance(
    nodeUrl: string,
    networkName: AztecNetwork,
    key: string
  ): Promise<SharedPXEInstance> {
    logger.info(`Initializing PXE for network: ${networkName}`);

    const aztecNode = NetworkService.getNodeClient(nodeUrl);

    // Get L1 contracts for network-specific database
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    const storeName = `aztec-pxe-${networkName}`;

    // Reuse a single store per network
    const pxeStore = await this.getOrCreateStore(networkName, storeName);

    const config = getPXEConfig();
    config.l1Contracts = l1Contracts;
    config.proverEnabled = getProverEnabled(networkName);

    const pxe = await createPXE(aztecNode, config, {
      store: pxeStore,
    });

    const wallet = new MinimalWallet(pxe, aztecNode);

    // Register fee payment contracts
    const feePaymentRegister = new FeePaymentRegister();
    await feePaymentRegister.registerAll(
      pxe,
      getNetworkDeployments(networkName)
    );

    // Initialize network-scoped storage service
    const storageService = new AztecStorageService(networkName);

    // Register saved senders
    await this.registerSavedSenders(pxe, storageService);

    const nodeInfo = await aztecNode.getNodeInfo();
    logger.info(`PXE connected to ${networkName}`, nodeInfo);

    const instance: SharedPXEInstance = {
      pxe,
      aztecNode,
      wallet,
      getSponsoredFeePaymentMethod: () =>
        this.getSponsoredFeePaymentMethod(key, pxe),
    };

    this.instances.set(key, {
      instance,
      nodeUrl,
      networkName,
    });

    return instance;
  }

  private async getOrCreateStore(
    networkName: AztecNetwork,
    storeName: string
  ): Promise<Awaited<ReturnType<typeof createStore>>> {
    const existingPromise = this.storePromises.get(networkName);
    if (existingPromise) {
      return existingPromise;
    }

    const createPromise = this.createPXEStoreWithFallback(storeName);
    this.storePromises.set(networkName, createPromise);

    try {
      return await createPromise;
    } catch (err) {
      this.storePromises.delete(networkName);
      throw err;
    }
  }

  private async createPXEStoreWithFallback(
    storeName: string
  ): Promise<Awaited<ReturnType<typeof createStore>>> {
    try {
      return await createStore(
        storeName,
        {
          dataDirectory: 'pxe',
          dataStoreMapSizeKb: SharedPXEServiceClass.PERSISTED_STORE_KB,
        },
        undefined,
        pxeLogger
      );
    } catch (error) {
      logger.warn(
        `Failed to create persistent PXE store (limit ${
          SharedPXEServiceClass.PERSISTED_STORE_KB
        } KB). Retrying with smaller ephemeral store.`,
        { error }
      );

      return await createStore(
        `${storeName}-tmp`,
        {
          dataDirectory: 'pxe-tmp',
          dataStoreMapSizeKb: SharedPXEServiceClass.FALLBACK_STORE_KB,
        },
        undefined,
        pxeLogger
      );
    }
  }

  private async getSponsoredPFCContract(_pxe: PXE) {
    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );

    return await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );
  }

  private async getSponsoredFeePaymentMethod(
    key: string,
    pxe: PXE
  ): Promise<SponsoredFeePaymentMethod> {
    const cached = this.cachedPaymentMethods.get(key);
    if (cached) {
      return cached;
    }

    const sponsoredPFCContract = await this.getSponsoredPFCContract(pxe);
    const paymentMethod = new SponsoredFeePaymentMethod(
      sponsoredPFCContract.address
    );

    this.cachedPaymentMethods.set(key, paymentMethod);

    return paymentMethod;
  }

  private async registerSavedSenders(
    pxe: PXE,
    storageService: AztecStorageService
  ): Promise<void> {
    try {
      const savedSenders = storageService.getSenders();

      if (savedSenders.length === 0) {
        return;
      }

      logger.info(`Registering ${savedSenders.length} saved senders with PXE`);

      for (const senderAddressString of savedSenders) {
        try {
          const senderAddress = AztecAddress.fromString(senderAddressString);
          await pxe.registerSender(senderAddress);
        } catch {
          // Sender might already be registered
          logger.warn(`Failed to register sender ${senderAddressString}`);
        }
      }
    } catch (error) {
      logger.error('Error registering saved senders:', error);
    }
  }
}

// Export singleton instance
export const SharedPXEService = new SharedPXEServiceClass();
