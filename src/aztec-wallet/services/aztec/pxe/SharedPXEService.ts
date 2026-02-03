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
import { getEnv } from '../../../../utils/env';
import { NetworkService } from '../network';
import { AztecStorageService } from '../storage';
import type { AztecNetwork } from '../../../../config/networks/constants';

const logger = createLogger('shared-pxe-service');
const pxeLogger = createLogger('pxe');
const PROVER_ENABLED = getEnv().proverEnabled;

export interface SharedPXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  wallet: MinimalWallet;
  storageService: AztecStorageService;
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
   * If already initializing, returns the same promise to avoid duplicate initialization.
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
      // Reuse if URL matches, else replace stale one for this network
      if (existing.nodeUrl === normalizedNodeUrl) {
        return existing.instance;
      }
      this.clearInstance(existing.nodeUrl, existing.networkName);
    }

    // Return in-progress initialization if exists
    const initPromise = this.initPromises.get(key);
    if (initPromise) {
      return initPromise;
    }

    // Start new initialization
    const promise = this.initializeInstance(
      normalizedNodeUrl,
      networkName,
      key
    );
    this.initPromises.set(key, promise);

    try {
      const instance = await promise;
      return instance;
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
  getExistingInstance(
    nodeUrl: string,
    networkName: AztecNetwork
  ): SharedPXEInstance | null {
    const key = this.getInstanceKey(networkName);
    return this.instances.get(key)?.instance ?? null;
  }

  /**
   * Clear a specific PXE instance (useful for network switching)
   */
  clearInstance(nodeUrl: string, networkName: AztecNetwork): void {
    const key = this.getInstanceKey(networkName);
    this.instances.delete(key);
    this.cachedPaymentMethods.delete(key);
    logger.info(`Cleared PXE instance for ${networkName}`);
  }

  /**
   * Clear all PXE instances
   */
  clearAll(): void {
    this.instances.clear();
    this.cachedPaymentMethods.clear();
    logger.info('Cleared all PXE instances');
  }

  private getInstanceKey(networkName: AztecNetwork | string): string {
    return `${networkName}`;
  }

  private getFeePaymentConfig(networkName: string) {
    const networkConfig = AVAILABLE_NETWORKS.find(
      (n) => n.name === networkName
    );
    return networkConfig?.feePaymentContracts;
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
    config.proverEnabled = PROVER_ENABLED;

    const pxe = await createPXE(aztecNode, config, {
      store: pxeStore,
      useLogSuffix: false,
    });

    const wallet = new MinimalWallet(pxe, aztecNode);

    // Register fee payment contracts (look up config by network name)
    const feePaymentConfig = this.getFeePaymentConfig(networkName);
    const feePaymentRegister = new FeePaymentRegister();
    await feePaymentRegister.registerAll(pxe, feePaymentConfig);

    // Initialize storage service
    const storageService = new AztecStorageService();

    // Register saved senders
    await this.registerSavedSenders(pxe, storageService);

    const nodeInfo = await aztecNode.getNodeInfo();
    logger.info(`PXE connected to ${networkName}`, nodeInfo);

    const instance: SharedPXEInstance = {
      pxe,
      aztecNode,
      wallet,
      storageService,
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
    return createPromise;
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
