import { createLogger } from '@aztec/aztec.js/log';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { Fr } from '@aztec/aztec.js/fields';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE } from '@aztec/pxe/client/lazy';
import { createStore } from '@aztec/kv-store/indexeddb';
import { MinimalWallet } from '../../../utils/MinimalWallet';
import { AztecStorageService } from '../storage';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getEnv } from '../../../utils/env';

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
  networkName: string;
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

  /**
   * Get or create a PXE instance for a specific network.
   * If already initializing, returns the same promise to avoid duplicate initialization.
   */
  async getInstance(
    nodeUrl: string,
    networkName: string
  ): Promise<SharedPXEInstance> {
    const key = this.getInstanceKey(nodeUrl, networkName);

    // Return existing instance if available
    const existing = this.instances.get(key);
    if (existing) {
      return existing.instance;
    }

    // Return in-progress initialization if exists
    const initPromise = this.initPromises.get(key);
    if (initPromise) {
      return initPromise;
    }

    // Start new initialization
    const promise = this.initializeInstance(nodeUrl, networkName, key);
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
  isInitialized(nodeUrl: string, networkName: string): boolean {
    const key = this.getInstanceKey(nodeUrl, networkName);
    return this.instances.has(key);
  }

  /**
   * Check if initialization is in progress for a network
   */
  isInitializing(nodeUrl: string, networkName: string): boolean {
    const key = this.getInstanceKey(nodeUrl, networkName);
    return this.initPromises.has(key);
  }

  /**
   * Get existing instance without initialization (returns null if not initialized)
   */
  getExistingInstance(
    nodeUrl: string,
    networkName: string
  ): SharedPXEInstance | null {
    const key = this.getInstanceKey(nodeUrl, networkName);
    return this.instances.get(key)?.instance ?? null;
  }

  /**
   * Clear a specific PXE instance (useful for network switching)
   */
  clearInstance(nodeUrl: string, networkName: string): void {
    const key = this.getInstanceKey(nodeUrl, networkName);
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

  private getInstanceKey(nodeUrl: string, networkName: string): string {
    return `${networkName}:${nodeUrl}`;
  }

  private async initializeInstance(
    nodeUrl: string,
    networkName: string,
    key: string
  ): Promise<SharedPXEInstance> {
    logger.info(`Initializing PXE for network: ${networkName}`);

    const aztecNode = createAztecNodeClient(nodeUrl);

    // Get L1 contracts for network-specific database
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    const storeName = `aztec-pxe-${networkName}`;

    // Create PXE store with IndexedDB for persistence
    const pxeStore = await createStore(
      storeName,
      {
        dataDirectory: 'pxe',
        dataStoreMapSizeKb: 2e10, // 20GB max size
      },
      pxeLogger
    );

    const config = getPXEConfig();
    config.l1Contracts = l1Contracts;
    config.proverEnabled = PROVER_ENABLED;

    const pxe = await createPXE(aztecNode, config, {
      store: pxeStore,
      useLogSuffix: false,
    });

    const wallet = new MinimalWallet(pxe, aztecNode);

    // Register SponsoredFPC contract
    const sponsoredPFCInstance = await this.getSponsoredPFCContract(pxe);
    await pxe.registerContract({
      instance: sponsoredPFCInstance,
      artifact: SponsoredFPCContractArtifact,
    });

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

  private async getSponsoredPFCContract(pxe: PXE) {
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
        } catch (error) {
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
