import { Fr } from '@aztec/aztec.js/fields';
import { createLogger } from '@aztec/aztec.js/log';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { AccountManager, BaseWallet, type Wallet } from '@aztec/aztec.js/wallet';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash, randomBytes } from '@aztec/foundation/crypto';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE } from '@aztec/pxe/client/lazy';
import { getInitialTestAccountsData } from '@aztec/accounts/testing/lazy';
import { IAztecWalletService, CreateAccountResult } from '../../../types';
import {
  type AccountWithSecretKey,
  type Account,
  SignerlessAccount,
} from '@aztec/aztec.js/account';

//TODO: This by default should be true, but set it to false to test
const PROVER_ENABLED = false;
const logger = createLogger('wallet-service');

/**
 * MinimalWallet extends BaseWallet to bootstrap account creation
 * This bridges PXE to the Wallet interface required by AccountManager
 */
class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    super(pxe as unknown as any, aztecNode);
  }

  public addAccount(account: AccountWithSecretKey) {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  protected async getAccountFromAddress(address: AztecAddress): Promise<Account> {
    let account: Account | undefined;
    if (address.equals(AztecAddress.ZERO)) {
      const chainInfo = await this.getChainInfo();
      account = new SignerlessAccount(chainInfo);
    } else {
      account = this.addressToAccount.get(address.toString());
    }

    if (!account)
      throw new Error(`Account not found in wallet for address: ${address.toString()}`);
    return account;
  }

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({
      alias: '',
      item: acc.getAddress(),
    }));
  }
}

/**
 * Core service for Aztec wallet operations
 */
export class AztecWalletService implements IAztecWalletService {
  private pxe!: PXE;
  private aztecNode!: AztecNode;
  private minimalWallet!: MinimalWallet;

  /**
   * Initialize PXE service and connect to Aztec node
   */
  async initialize(nodeUrl: string): Promise<void> {
    // Create Aztec Node Client
    this.aztecNode = createAztecNodeClient(nodeUrl);

    // Create PXE Service
    const config = getPXEConfig();
    config.proverEnabled = PROVER_ENABLED;
    this.pxe = await createPXE(this.aztecNode, config);

    // Create MinimalWallet for account management
    this.minimalWallet = new MinimalWallet(this.pxe, this.aztecNode);

    // Register Sponsored FPC Contract with PXE
    await this.pxe.registerContract({
      instance: await this.getSponsoredPFCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // Log the Node Info
    const nodeInfo = await this.aztecNode.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);
  }

  /**
   * Get the PXE instance
   */
  getPXE(): PXE {
    return this.pxe;
  }

  /**
   * Get the MinimalWallet for contract interactions
   */
  getWallet(): Wallet {
    return this.minimalWallet;
  }

  /**
   * Helper method to create contract instance from deploy params
   */
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

  /**
   * Get the Sponsored FPC Contract for fee payment
   */
  private async getSponsoredPFCContract() {
    const instance = await this.getContractInstanceFromDeployParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    return instance;
  }

  /**
   * Connect to a test account
   */
  async connectTestAccount(index: number): Promise<AccountWithSecretKey> {
    const testAccounts = await getInitialTestAccountsData();
    const account = testAccounts[index];

    // Create account contract with the test account's signing key
    const accountContract = new SchnorrAccountContract(account.signingKey);

    // Use MinimalWallet for AccountManager
    const accountManager = await AccountManager.create(
      this.minimalWallet,
      account.secret,
      accountContract,
      account.salt
    );

    // Get the account wallet
    const wallet = await accountManager.getAccount();

    // Register the account with MinimalWallet
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
  async createEcdsaAccount(): Promise<CreateAccountResult> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    // Generate random credentials for each new account
    const saltBuffer = randomBytes(32);
    const salt = Fr.fromBuffer(saltBuffer);

    const secretBuffer = randomBytes(32);
    const secretKey = await poseidon2Hash([Fr.fromBuffer(secretBuffer)]);

    const signingKey = Buffer.from(secretKey.toBuffer().subarray(0, 32));

    // Create an ECDSA account contract
    const accountContract = new EcdsaRAccountContract(signingKey);

    // Use MinimalWallet for AccountManager
    const ecdsaAccount = await AccountManager.create(
      this.minimalWallet,
      secretKey,
      accountContract,
      salt
    );

    // Get the wallet
    const ecdsaWallet = await ecdsaAccount.getAccount();

    // Register the account with MinimalWallet
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

  /**
   * Deploy an ECDSA account
   */
  async deployEcdsaAccount(ecdsaAccount: AccountManager): Promise<void> {
    // Deploy the account
    const deployMethod = await ecdsaAccount.getDeployMethod();
    const deployOpts = {
      contractAddressSalt: Fr.fromString(ecdsaAccount.salt.toString()),
      fee: {
        paymentMethod: await this.getSponsoredFeePaymentMethod(),
      },
      universalDeploy: true,
      skipClassRegistration: true,
      skipPublicDeployment: true,
      skipClassPublication: true,
      from: ecdsaAccount.address,
    };

    // Generate proof and send deployment transaction
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
    // Create an ECDSA account contract
    const accountContract = new EcdsaRAccountContract(signingKey);

    // Use MinimalWallet for AccountManager
    const ecdsaAccount = await AccountManager.create(
      this.minimalWallet,
      secretKey,
      accountContract,
      salt
    );

    logger.info('Account created from credentials', ecdsaAccount.address.toString());

    const ecdsaWallet = await ecdsaAccount.getAccount();

    // Register the account with MinimalWallet
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
