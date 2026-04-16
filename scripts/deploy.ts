import 'dotenv/config';
import { DripperContractArtifact } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { TokenContractArtifact } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';
import {
  NO_FROM,
  type AccountWithSecretKey,
  type Account,
} from '@aztec/aztec.js/account';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  getContractInstanceFromInstantiationParams,
  DeployMethod,
  Contract,
  type DeployOptions,
} from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { PublicKeys } from '@aztec/aztec.js/keys';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import {
  ContractInitializationStatus,
  AccountManager,
  type Wallet,
} from '@aztec/aztec.js/wallet';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { createStore } from '@aztec/kv-store/lmdb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getPXEConfig } from '@aztec/pxe/config';
import type { PXE } from '@aztec/pxe/server';
import { createPXE } from '@aztec/pxe/server';
import { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import fs from 'fs';
import path from 'path';
import {
  NETWORK_URLS,
  type NetworkType,
} from '../src/config/networks/constants';

class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    super(pxe, aztecNode);
  }

  public addAccount(account: AccountWithSecretKey) {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  protected async getAccountFromAddress(
    address: AztecAddress
  ): Promise<Account> {
    const account = this.addressToAccount.get(address.toString());

    if (!account)
      throw new Error(
        `Account not found in wallet for address: ${address.toString()}`
      );
    return account;
  }

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({
      alias: '',
      item: acc.getAddress(),
    }));
  }
}

// Parse command line arguments
const parseArgs = (): { network: NetworkType } => {
  const args = process.argv.slice(2);
  const networkIndex = args.findIndex(
    (arg) => arg === '--network' || arg === '-n'
  );

  if (networkIndex !== -1 && args[networkIndex + 1]) {
    const network = args[networkIndex + 1] as NetworkType;
    if (network !== 'sandbox' && network !== 'devnet') {
      console.error(
        `Invalid network: ${network}. Must be 'sandbox' or 'devnet'`
      );
      process.exit(1);
    }
    return { network };
  }

  return { network: 'sandbox' };
};

const { network: NETWORK } = parseArgs();

// Environment variable overrides
const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || NETWORK_URLS[NETWORK];
const PROVER_ENABLED =
  process.env.VITE_PROVER_ENABLED !== undefined
    ? process.env.VITE_PROVER_ENABLED.toLowerCase() === 'true'
    : NETWORK !== 'sandbox';
const FPC_ENABLED = process.env.VITE_FPC_ENABLED !== 'false';

const DEPLOY_TIMEOUT = 960;
const PXE_STORE_DIR = path.join(import.meta.dirname, '.store');

async function setupPXE() {
  console.log(`\n🔧 Setting up PXE for ${NETWORK}...`);
  console.log(`   Node URL: ${AZTEC_NODE_URL}`);
  console.log(`   Prover: ${PROVER_ENABLED ? 'enabled' : 'disabled'}\n`);

  const aztecNode = createAztecNodeClient(AZTEC_NODE_URL);

  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });

  const store = await createStore('pxe', {
    dataDirectory: PXE_STORE_DIR,
    dataStoreMapSizeKb: 1e6,
  });

  const config = {
    ...getPXEConfig(),
    proverEnabled: PROVER_ENABLED,
  };

  const pxe = await createPXE(aztecNode, config, {
    store,
  });

  return { pxe, aztecNode };
}

async function getSponsoredFPCContract() {
  const instance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  return instance;
}

const getSponsoredFeePaymentMethod = async () => {
  const sponsoredPFCContract = await getSponsoredFPCContract();
  return new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
};

// These credentials could also be randomly generated, but we use a fixed one for testing purposes
async function getDefaultCredentials() {
  const holaSecretKey = await poseidon2Hash([
    Fr.fromBufferReduce(Buffer.from('hola'.padEnd(32, '#'), 'utf8')),
  ]);
  return {
    salt: new Fr(1337n),
    secretKey: holaSecretKey,
    signingKey: Buffer.alloc(32, holaSecretKey.toBuffer()),
  };
}

async function generateCredentials() {
  if (process.env.VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE) {
    // If we have a secret phrase, we use it to generate the credentials
    const secretKey = await poseidon2Hash([
      Fr.fromBufferReduce(
        Buffer.from(
          process.env.VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE.padEnd(32, '#'),
          'utf8'
        )
      ),
    ]);
    return {
      secretKey,
      salt: Fr.fromString(process.env.VITE_COMMON_SALT || '1337'),
      signingKey: Buffer.from(secretKey.toBuffer().subarray(0, 32)),
    };
  } else if (
    process.env.VITE_EMBEDDED_ACCOUNT_SECRET_KEY &&
    process.env.VITE_COMMON_SALT
  ) {
    // If we have a secret key and salt, we use them to generate the credentials
    return {
      salt: Fr.fromString(process.env.VITE_COMMON_SALT),
      secretKey: Fr.fromString(process.env.VITE_EMBEDDED_ACCOUNT_SECRET_KEY),
      signingKey: Buffer.from(
        process.env.VITE_EMBEDDED_ACCOUNT_SIGNING_KEY!,
        'hex'
      ),
    };
  } else {
    console.log('Generating default credentials...');
    // Otherwise, we generate default credentials
    return getDefaultCredentials();
  }
}

async function createAccount(pxe: PXE, node: AztecNode) {
  console.log('👤 Setting up deployer account...');

  const { secretKey, salt, signingKey } = await generateCredentials();
  console.log('   Credentials generated:');
  console.log(`   - Secret Key: ${secretKey.toString().slice(0, 20)}...`);
  console.log(`   - Salt: ${salt.toString().slice(0, 20)}...`);

  const wallet = new MinimalWallet(pxe, node);
  const accountContract = new EcdsaRAccountContract(signingKey);
  const manager = await AccountManager.create(
    wallet,
    secretKey,
    accountContract,
    salt
  );
  const account = await manager.getAccount();
  const instance = manager.getInstance();
  const artifact = await manager.getAccountContract().getContractArtifact();

  await wallet.registerContract(instance, artifact, manager.getSecretKey());
  wallet.addAccount(account);

  console.log(`   ✅ Account created: ${account.getAddress().toString()}`);

  const metadata = await wallet.getContractMetadata(account.getAddress());
  if (
    metadata.initializationStatus !== ContractInitializationStatus.INITIALIZED
  ) {
    console.log('   📦 Deploying account contract...');
    const deployMethod = await manager.getDeployMethod();
    // Use NO_FROM to trigger self-deployment mode:
    // DeployAccountMethod routes the tx so the constructor runs first (initializing
    // the signing key), then the entrypoint handles fee payment.
    // Using the account's own address would fail because the wallet would try to
    // call entrypoint before the account is initialized.
    await deployMethod.send({
      from: NO_FROM,
      ...(FPC_ENABLED
        ? { fee: { paymentMethod: await getSponsoredFeePaymentMethod() } }
        : {}),
      skipClassPublication: true,
      skipInstancePublication: true,
      wait: { timeout: DEPLOY_TIMEOUT },
    });
    console.log('   ✅ Account deployed');
  } else {
    console.log('   ✅ Account already deployed');
  }

  return {
    wallet,
    account,
  };
}

async function deployDripperContract(
  pxe: PXE,
  deployer: Wallet,
  options: DeployOptions
) {
  console.log('📦 Deploying Dripper contract...');

  const salt = Fr.fromString(process.env.VITE_COMMON_SALT || '1337');

  // Compute the expected address first
  const expectedInstance = await getContractInstanceFromInstantiationParams(
    DripperContractArtifact,
    {
      salt,
      constructorArgs: [],
      deployer: AztecAddress.ZERO, // universalDeploy uses ZERO deployer
      publicKeys: PublicKeys.default(),
    }
  );

  // Check if contract is already deployed
  const metadata = await deployer.getContractMetadata(expectedInstance.address);
  if (
    metadata.initializationStatus === ContractInitializationStatus.INITIALIZED
  ) {
    // Register the contract with PXE so it's available for the app
    await pxe.registerContract({
      instance: expectedInstance,
      artifact: DripperContractArtifact,
    });
    console.log(
      `   ✅ Dripper already deployed at: ${expectedInstance.address.toString()}`
    );
    return {
      instance: null,
      address: expectedInstance.address.toString(),
      salt: salt.toString(),
    };
  }

  const deployMethod = new DeployMethod(
    PublicKeys.default(),
    deployer,
    DripperContractArtifact,
    (instance, wallet) =>
      Contract.at(instance.address, DripperContractArtifact, wallet),
    [],
    'constructor'
  );

  try {
    const result = await deployMethod.send({
      ...options,
      contractAddressSalt: salt,
      ...(FPC_ENABLED
        ? { fee: { paymentMethod: await getSponsoredFeePaymentMethod() } }
        : {}),
      universalDeploy: true,
      skipInitialization: false,
      wait: { timeout: DEPLOY_TIMEOUT, returnReceipt: true as const },
    });

    console.log(`   Mined at block: ${result.receipt.blockNumber}`);
    console.log(`   Tx hash: ${result.receipt.txHash}`);

    const contract = result.receipt.contract;
    console.log(`   ✅ Dripper deployed at: ${contract.address.toString()}`);

    // Contract is already registered during deployment via DeployMethod
    return {
      instance: null,
      address: contract.address.toString(),
      salt: salt.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Existing nullifier')) {
      // Contract already deployed but metadata check didn't detect it
      // Register the contract with PXE so it's available for the app
      await pxe.registerContract({
        instance: expectedInstance,
        artifact: DripperContractArtifact,
      });
      console.log(
        `   ✅ Dripper already deployed at: ${expectedInstance.address.toString()}`
      );
      return {
        instance: null,
        address: expectedInstance.address.toString(),
        salt: salt.toString(),
      };
    }
    throw error;
  }
}

async function deployTokenContract(
  pxe: PXE,
  deployer: Wallet,
  options: DeployOptions,
  dripperAddress: AztecAddress
) {
  console.log('📦 Deploying Token contract...');

  const salt = Fr.fromString(process.env.VITE_COMMON_SALT || '1337');

  const constructorArgs = [
    'WETH', // name
    'WETH', // symbol
    18, // decimals
    dripperAddress, // minter (Dripper address)
  ];

  // Compute the expected address first
  const expectedInstance = await getContractInstanceFromInstantiationParams(
    TokenContractArtifact,
    {
      salt,
      constructorArgs,
      deployer: AztecAddress.ZERO, // universalDeploy uses ZERO deployer
      publicKeys: PublicKeys.default(),
      constructorArtifact: 'constructor_with_minter',
    }
  );

  // Check if contract is already deployed
  const metadata = await deployer.getContractMetadata(expectedInstance.address);
  if (
    metadata.initializationStatus === ContractInitializationStatus.INITIALIZED
  ) {
    // Register the contract with PXE so it's available for the app
    await pxe.registerContract({
      instance: expectedInstance,
      artifact: TokenContractArtifact,
    });
    console.log(
      `   ✅ Token already deployed at: ${expectedInstance.address.toString()}`
    );
    return {
      instance: null,
      address: expectedInstance.address.toString(),
      salt: salt.toString(),
    };
  }

  // Use constructor_with_minter: name, symbol, decimals, minter
  const deployMethod = new DeployMethod(
    PublicKeys.default(),
    deployer,
    TokenContractArtifact,
    (instance, wallet) =>
      Contract.at(instance.address, TokenContractArtifact, wallet),
    constructorArgs,
    'constructor_with_minter'
  );

  try {
    const result = await deployMethod.send({
      ...options,
      contractAddressSalt: salt,
      ...(FPC_ENABLED
        ? { fee: { paymentMethod: await getSponsoredFeePaymentMethod() } }
        : {}),
      universalDeploy: true,
      skipInitialization: false,
      wait: { timeout: DEPLOY_TIMEOUT, returnReceipt: true as const },
    });

    console.log(`   Mined at block: ${result.receipt.blockNumber}`);
    console.log(`   Tx hash: ${result.receipt.txHash}`);

    const contract = result.receipt.contract;
    console.log(`   ✅ Token deployed at: ${contract.address.toString()}`);

    // Contract is already registered during deployment via DeployMethod
    return {
      instance: null,
      address: contract.address.toString(),
      salt: salt.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Existing nullifier')) {
      // Contract already deployed but metadata check didn't detect it
      // Register the contract with PXE so it's available for the app
      await pxe.registerContract({
        instance: expectedInstance,
        artifact: TokenContractArtifact,
      });
      console.log(
        `   ✅ Token already deployed at: ${expectedInstance.address.toString()}`
      );
      return {
        instance: null,
        address: expectedInstance.address.toString(),
        salt: salt.toString(),
      };
    }
    throw error;
  }
}

interface DeploymentInfo {
  dripperContract: {
    address: string;
    salt: string;
  };
  tokenContract: {
    address: string;
    salt: string;
  };
  deployer: string;
}

async function writeDeploymentConfig(
  network: NetworkType,
  deploymentInfo: DeploymentInfo
) {
  const configDir = path.join(import.meta.dirname, `../src/config/deployments`);
  const configFilePath = path.join(configDir, `${network}.json`);

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const config = {
    network,
    nodeUrl: AZTEC_NODE_URL,
    dripperContract: {
      address: deploymentInfo.dripperContract.address,
      salt: deploymentInfo.dripperContract.salt,
    },
    tokenContract: {
      address: deploymentInfo.tokenContract.address,
      salt: deploymentInfo.tokenContract.salt,
    },
    deployer: deploymentInfo.deployer,
    proverEnabled: PROVER_ENABLED,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2) + '\n');

  console.log('\nDeployment successful');
  console.log(`- Network:  ${network}`);
  console.log(`- Config:   src/config/deployments/${network}.json`);
  console.log(`- Dripper:  ${deploymentInfo.dripperContract.address}`);
  console.log(`- Token:    ${deploymentInfo.tokenContract.address}`);
  console.log(`- Deployer: ${deploymentInfo.deployer}\n`);
}

async function createAccountAndDeployContract() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           AZTEC CONTRACT DEPLOYMENT                            ║
║           Network: ${NETWORK.padEnd(42)}║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    const { pxe, aztecNode } = await setupPXE();

    // Register the SponsoredFPC contract (for sponsored fee payments)
    if (FPC_ENABLED) {
      await pxe.registerContract({
        instance: await getSponsoredFPCContract(),
        artifact: SponsoredFPCContractArtifact,
      });
    } else {
      console.log('⏭️ FPC disabled — skipping SponsoredFPC registration');
    }

    // Create a new account
    const { wallet, account } = await createAccount(pxe, aztecNode);

    const deployOptions: DeployOptions = {
      from: account.getAddress(),
    };

    // Deploy the Dripper contract first
    const dripperDeploymentInfo = await deployDripperContract(
      pxe,
      wallet,
      deployOptions
    );

    // Deploy the Token contract with Dripper as minter
    const tokenDeploymentInfo = await deployTokenContract(
      pxe,
      wallet,
      deployOptions,
      AztecAddress.fromString(dripperDeploymentInfo.address)
    );

    // Save the deployment info to JSON config file
    await writeDeploymentConfig(NETWORK, {
      dripperContract: {
        address: dripperDeploymentInfo.address,
        salt: dripperDeploymentInfo.salt,
      },
      tokenContract: {
        address: tokenDeploymentInfo.address,
        salt: tokenDeploymentInfo.salt,
      },
      deployer: account.getAddress().toString(),
    });
  } finally {
    // Always clean up the PXE store, even on failure
    fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
  }
}

createAccountAndDeployContract()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

export { createAccountAndDeployContract };
