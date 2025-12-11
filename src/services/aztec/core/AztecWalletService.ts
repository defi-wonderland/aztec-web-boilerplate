import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createLogger } from '@aztec/aztec.js/log';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { AccountManager, type Wallet } from '@aztec/aztec.js/wallet';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash, randomBytes } from '@aztec/foundation/crypto';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE } from '@aztec/pxe/client/lazy';
import { createStore } from '@aztec/kv-store/indexeddb';
import { getInitialTestAccountsData } from '@aztec/accounts/testing/lazy';
import { type AccountWithSecretKey } from '@aztec/aztec.js/account';
import {
  IAztecWalletService,
  CreateAccountResult,
  AccountCredentials,
} from '../../../types';
import { MinimalWallet } from '../../../utils/MinimalWallet';

const PROVER_ENABLED = false;
const logger = createLogger('wallet-service');
const pxeLogger = createLogger('pxe');

/**
 * Core service for Aztec wallet operations
 */
export class AztecWalletService implements IAztecWalletService {
  private pxe!: PXE;
  private aztecNode!: AztecNode;
  private minimalWallet!: MinimalWallet;

  /**
   * Initialize PXE service and connect to Aztec node
   * 
   * @param nodeUrl - URL of the Aztec node
   * @param networkName - Optional network name (sandbox, devnet, etc.) for readable store name
   */
  async initialize(nodeUrl: string, networkName?: string): Promise<void> {
    this.aztecNode = createAztecNodeClient(nodeUrl);

    // Get L1 contracts for network-specific database and config
    const l1Contracts = await this.aztecNode.getL1ContractAddresses();
    const rollupAddress = l1Contracts.rollupAddress;

    // Use network name for readability, fallback to rollup address for uniqueness
    const storeName = networkName 
      ? `aztec-pxe-${networkName}` 
      : `aztec-pxe-${rollupAddress.toString()}`;

    // Create PXE store with IndexedDB for persistence across reloads
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

    this.pxe = await createPXE(this.aztecNode, config, {
      store: pxeStore,
      useLogSuffix: false,
    });

    this.minimalWallet = new MinimalWallet(this.pxe, this.aztecNode);

    await this.pxe.registerContract({
      instance: await this.getSponsoredPFCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    const nodeInfo = await this.aztecNode.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);
  }

  getPXE(): PXE {
    return this.pxe;
  }

  getWallet(): Wallet {
    return this.minimalWallet;
  }

  private async getContractInstanceFromDeployParams(
    artifact: unknown,
    params: unknown
  ) {
    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );
    return await getContractInstanceFromInstantiationParams(
      artifact as Parameters<typeof getContractInstanceFromInstantiationParams>[0],
      params as Parameters<typeof getContractInstanceFromInstantiationParams>[1]
    );
  }

  private async getSponsoredPFCContract() {
    const instance = await this.getContractInstanceFromDeployParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    return instance;
  }

  async connectTestAccount(index: number): Promise<AccountWithSecretKey> {
    const testAccounts = await getInitialTestAccountsData();
    const account = testAccounts[index];

    const accountContract = new SchnorrAccountContract(account.signingKey);

    const accountManager = await AccountManager.create(
      this.minimalWallet,
      account.secret,
      accountContract,
      account.salt
    );

    const wallet = await accountManager.getAccount();

    const instance = accountManager.getInstance();
    const artifact = await accountManager.getAccountContract().getContractArtifact();
    await this.minimalWallet.registerContract(instance, artifact, accountManager.getSecretKey());
    this.minimalWallet.addAccount(wallet);

    logger.info('Test account connected', wallet.getAddress().toString());

    return wallet;
  }

  /**
   * Create a new ECDSA account with randomly generated credentials.
   * Keys are generated fresh for each account - caller should persist them
   * using AztecStorageService for recovery.
   */
  async createEcdsaAccount(
    credentials?: AccountCredentials
  ): Promise<CreateAccountResult> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    const salt =
      credentials?.salt ??
      Fr.fromBuffer(randomBytes(32));

    const secretKey =
      credentials?.secretKey ??
      (await poseidon2Hash([Fr.fromBuffer(randomBytes(32))]));

    const signingKey =
      credentials?.signingKey ??
      Buffer.from(secretKey.toBuffer().subarray(0, 32));

    const accountContract = new EcdsaRAccountContract(signingKey);

    const ecdsaAccount = await AccountManager.create(
      this.minimalWallet,
      secretKey,
      accountContract,
      salt
    );

    // Get thewallet
    const ecdsaWallet = await ecdsaAccount.getAccount();

    const instance = ecdsaAccount.getInstance();
    const artifact = await ecdsaAccount.getAccountContract().getContractArtifact();
    await this.minimalWallet.registerContract(instance, artifact, ecdsaAccount.getSecretKey());
    this.minimalWallet.addAccount(ecdsaWallet);

    logger.info('New ECDSA account created', ecdsaAccount.address.toString());

    return {
      account: ecdsaAccount,
      wallet: ecdsaWallet,
      salt,
      secretKey,
      signingKey,
    };
  }

  async deployEcdsaAccount(ecdsaAccount: AccountManager): Promise<void> {
    const deployMethod = await ecdsaAccount.getDeployMethod();
    const deployOpts = {
      from: AztecAddress.ZERO,
      fee: {
        paymentMethod: await this.getSponsoredFeePaymentMethod(),
      },
      skipClassPublication: true,
      skipInstancePublication: true,
    };

    const receipt = await deployMethod.send(deployOpts).wait({ timeout: 120 });

    logger.info('Account deployed', receipt);
  }

  /**
   * Create an ECDSA account from existing credentials
   * This only registers the account with PXE - deployment should be handled separately in background
   */
  async createEcdsaAccountFromCredentials(
    secretKey: Fr,
    signingKey: Buffer,
    salt: Fr
  ): Promise<AccountWithSecretKey> {
    const accountContract = new EcdsaRAccountContract(signingKey);

    const ecdsaAccount = await AccountManager.create(
      this.minimalWallet,
      secretKey,
      accountContract,
      salt
    );

    logger.info('Account created from credentials', ecdsaAccount.address.toString());

    const ecdsaWallet = await ecdsaAccount.getAccount();

    const instance = ecdsaAccount.getInstance();
    const artifact = await ecdsaAccount.getAccountContract().getContractArtifact();
    await this.minimalWallet.registerContract(instance, artifact, ecdsaAccount.getSecretKey());
    this.minimalWallet.addAccount(ecdsaWallet);

    return ecdsaWallet;
  }

  /**
   * Get the SponsoredFeePaymentMethod instance (cached)
   */
  private cachedPaymentMethod: SponsoredFeePaymentMethod | null = null;

  async getSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    if (!this.cachedPaymentMethod) {
      const sponsoredPFCContract = await this.getSponsoredPFCContract();
      this.cachedPaymentMethod = new SponsoredFeePaymentMethod(
        sponsoredPFCContract.address
      );
    }
    return this.cachedPaymentMethod;
  }
}
