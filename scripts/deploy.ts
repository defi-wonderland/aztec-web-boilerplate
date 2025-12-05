import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  getContractInstanceFromInstantiationParams,
  DeployMethod,
  Contract,
  type DeployOptions,
} from '@aztec/aztec.js/contracts';
import { PublicKeys } from '@aztec/aztec.js/keys';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { type AccountWithSecretKey } from '@aztec/aztec.js/account';
import { AccountManager, type Wallet } from '@aztec/aztec.js/wallet';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE } from '@aztec/pxe/server';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';
import { createStore } from '@aztec/kv-store/lmdb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import {
  DripperContractArtifact,
  DripperContract,
} from '../src/artifacts/Dripper';
import { TokenContractArtifact } from '../src/artifacts/Token';
import { MinimalWallet } from './utils/MinimalWallet';
import {
  NETWORK_URLS,
  type NetworkType,
} from '../src/config/networks/constants';

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
// const PROVER_ENABLED =
//   process.env.VITE_PROVER_ENABLED === 'false' ? false : NETWORK === 'devnet';
const PROVER_ENABLED =
  process.env.VITE_PROVER_ENABLED === 'true' ? true : false;

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
    useLogSuffix: true,
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

async function generateCredentials() {
  if (process.env.VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE) {
    // If we have a secret phrase, we use it to generate the credentials
    const secretKey = await poseidon2Hash([
      Fr.fromBufferReduce(
        Buffer.from(process.env.VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE.padEnd(32, '#'), 'utf8')
      ),
    ]);
    return {
      secretKey,
      salt: Fr.fromString(process.env.VITE_COMMON_SALT || '1337'),
      signingKey: Buffer.from(secretKey.toBuffer().subarray(0, 32)),
    };
  } else if (process.env.VITE_EMBEDDED_ACCOUNT_SECRET_KEY && process.env.VITE_COMMON_SALT) {
    // If we have a secret key and salt, we use them to generate the credentials
    return {
      salt: Fr.fromString(process.env.VITE_COMMON_SALT),
      secretKey: Fr.fromString(process.env.VITE_EMBEDDED_ACCOUNT_SECRET_KEY),
      signingKey: Buffer.from(process.env.VITE_EMBEDDED_ACCOUNT_SIGNING_KEY!, 'hex'),
    };
  } else {
    // Otherwise, we generate random credentials
    return {
      salt: Fr.random(),
      secretKey: Fr.random(),
      signingKey: Buffer.alloc(32, Fr.random().toBuffer()),
    };
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
  if (!metadata.isContractInitialized) {
    console.log('   📦 Deploying account contract...');
    const sponsoredFeePaymentMethod = await getSponsoredFeePaymentMethod();
    const deployOpts = {
      from: AztecAddress.ZERO,
      contractAddressSalt: salt,
      fee: {
        paymentMethod: sponsoredFeePaymentMethod,
      },
      universalDeploy: true,
      skipClassRegistration: true,
      skipPublicDeployment: true,
    };
    const deployMethod = await manager.getDeployMethod();
    await deployMethod.send(deployOpts).wait({ timeout: DEPLOY_TIMEOUT });
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

  const deployMethod = new DeployMethod(
    PublicKeys.default(),
    deployer,
    DripperContractArtifact,
    (address) =>
      Contract.at(
        address,
        DripperContractArtifact,
        deployer
      ) as Promise<DripperContract>,
    [],
    'constructor'
  );

  const salt = process.env.VITE_COMMON_SALT
    ? Fr.fromString(process.env.VITE_COMMON_SALT)
    : Fr.random();

  const receipt = await deployMethod
    .send({
      ...options,
      contractAddressSalt: salt,
      fee: {
        paymentMethod: await getSponsoredFeePaymentMethod(),
      },
      universalDeploy: true,
      skipInitialization: false,
    })
    .wait({ timeout: DEPLOY_TIMEOUT });

  console.log(`   Mined at block: ${receipt.blockNumber}`);
  console.log(`   Tx hash: ${receipt.txHash}`);

  const contract = receipt.contract;
  console.log(`   ✅ Dripper deployed at: ${contract.address.toString()}`);

  const { instance, artifact } = receipt.contract;

  await pxe.registerContract({
    instance,
    artifact,
  });

  return {
    instance: instance,
    address: instance.address.toString(),
    salt: salt.toString(),
  };
}

async function deployTokenContract(
  pxe: PXE,
  deployer: Wallet,
  options: DeployOptions,
  dripperAddress: AztecAddress
) {
  console.log('📦 Deploying Token contract...');

  const salt = process.env.VITE_COMMON_SALT
    ? Fr.fromString(process.env.VITE_COMMON_SALT)
    : Fr.random();

  // Use Wonderland token constructor_with_minter
  // Signature: constructor_with_minter(name, symbol, decimals, minter, upgrade_authority)
  const deployMethod = new DeployMethod(
    PublicKeys.default(),
    deployer,
    TokenContractArtifact,
    (address) => Contract.at(address, TokenContractArtifact, deployer),
    [
      'Yield Token', // name
      'YT', // symbol
      18, // decimals
      dripperAddress, // minter (Dripper address - can mint tokens)
      AztecAddress.ZERO, // upgrade_authority
    ],
    'constructor_with_minter'
  );

  const receipt = await deployMethod
    .send({
      ...options,
      contractAddressSalt: salt,
      fee: {
        paymentMethod: await getSponsoredFeePaymentMethod(),
      },
      universalDeploy: true,
      skipInitialization: false,
    })
    .wait({ timeout: DEPLOY_TIMEOUT });

  console.log(`   Mined at block: ${receipt.blockNumber}`);
  console.log(`   Tx hash: ${receipt.txHash}`);

  const contract = receipt.contract;
  console.log(`   ✅ Token deployed at: ${contract.address.toString()}`);

  const { instance, artifact } = receipt.contract;

  await pxe.registerContract({
    instance,
    artifact,
  });

  return {
    instance: instance,
    address: instance.address.toString(),
    salt: salt.toString(),
  };
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

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    DEPLOYMENT SUCCESSFUL                       ║
╠════════════════════════════════════════════════════════════════╣
║  Network:  ${network.padEnd(49)}║
║  Config:   src/config/deployments/${network}.json${' '.repeat(28 - network.length)}║
╠════════════════════════════════════════════════════════════════╣
║  Dripper:  ${deploymentInfo.dripperContract.address.slice(0, 20)}...  ║
║  Token:    ${deploymentInfo.tokenContract.address.slice(0, 20)}...  ║
║  Deployer: ${deploymentInfo.deployer.slice(0, 20)}...  ║
╠════════════════════════════════════════════════════════════════╣
║  TIP: You can commit this config file to version control       ║
║       to share deployment addresses with your team.            ║
╚════════════════════════════════════════════════════════════════╝
`);
}

async function createAccountAndDeployContract() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           AZTEC CONTRACT DEPLOYMENT                            ║
║           Network: ${NETWORK.padEnd(42)}║
╚════════════════════════════════════════════════════════════════╝
`);

  const { pxe, aztecNode } = await setupPXE();

  // Register the SponsoredFPC contract (for sponsored fee payments)
  await pxe.registerContract({
    instance: await getSponsoredFPCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

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

  // Clean up the PXE store
  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
}

createAccountAndDeployContract().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});

export { createAccountAndDeployContract };
