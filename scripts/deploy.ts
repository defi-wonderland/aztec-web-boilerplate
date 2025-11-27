import fs from 'fs';
import path from 'path';
import {
  AztecAddress,
  createAztecNodeClient,
  Fr,
  getContractInstanceFromInstantiationParams,
  type PXE,
  SponsoredFeePaymentMethod,
  type Wallet,
} from '@aztec/aztec.js';
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { getInitialTestAccounts } from '@aztec/accounts/testing';
import { createStore } from '@aztec/kv-store/lmdb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/Token.js';

// Network configuration
type NetworkType = 'sandbox' | 'testnet';

interface NetworkUrls {
  sandbox: string;
  testnet: string;
}

const DEFAULT_NODE_URLS: NetworkUrls = {
  sandbox: 'http://localhost:8080',
  testnet: 'https://aztec-alpha-testnet-fullnode.zkv.xyz/',
};

// Parse command line arguments
const parseArgs = (): { network: NetworkType } => {
  const args = process.argv.slice(2);
  const networkIndex = args.findIndex(arg => arg === '--network' || arg === '-n');
  
  if (networkIndex !== -1 && args[networkIndex + 1]) {
    const network = args[networkIndex + 1] as NetworkType;
    if (network !== 'sandbox' && network !== 'testnet') {
      console.error(`Invalid network: ${network}. Must be 'sandbox' or 'testnet'`);
      process.exit(1);
    }
    return { network };
  }
  
  return { network: 'sandbox' };
};

const { network: NETWORK } = parseArgs();

// Environment variable overrides
const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || DEFAULT_NODE_URLS[NETWORK];
const PROVER_ENABLED = process.env.PROVER_ENABLED === 'false' ? false : NETWORK === 'testnet';

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

  const config = getPXEServiceConfig();
  config.dataDirectory = 'pxe';
  config.proverEnabled = PROVER_ENABLED;
  const configWithContracts = {
    ...config,
  };

  const pxe = await createPXEService(
    aztecNode,
    configWithContracts,
    {
      store,
      useLogSuffix: true,
    },
  );
  return pxe;
}

async function getSponsoredPFCContract() {
  const instance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  return instance;
}

async function createAccount(pxe: PXE) {
  // Use pre-deployed test account from sandbox (much simpler for development)
  const testAccounts = await getInitialTestAccounts();
  const testAccount = testAccounts[0];
  
  const schnorrAccount = await getSchnorrAccount(
    pxe,
    testAccount.secret,
    testAccount.signingKey,
    testAccount.salt
  );
  
  // Register the account (it's already deployed in sandbox)
  await schnorrAccount.register();
  const wallet = await schnorrAccount.getWallet();

  return {
    wallet,
    signingKey: testAccount.signingKey,
  };
}

async function deployDripperContract(pxe: PXE, deployer: Wallet) {
  console.log('📦 Deploying Dripper contract...');
  const salt = Fr.random();
  const sponsoredPFCContract = await getSponsoredPFCContract();

  // Use the Contract's deploy method which handles VK generation
  const receipt = await DripperContract.deploy(deployer)
    .send({
      contractAddressSalt: salt,
      from: deployer.getAddress(),
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredPFCContract.address),
      },
    })
    .wait({ timeout: 120 });

  console.log(`   ✅ Dripper deployed at: ${receipt.contract.address.toString()}`);

  return {
    contractAddress: receipt.contract.address.toString(),
    deployerAddress: deployer.getAddress().toString(),
    deploymentSalt: salt.toString(),
  };
}

async function deployTokenContract(pxe: PXE, deployer: Wallet, dripperAddress: AztecAddress) {
  console.log('📦 Deploying Token contract...');
  const salt = Fr.random();
  const sponsoredPFCContract = await getSponsoredPFCContract();

  // Deploy Wonderland Token with constructor_with_minter
  // Constructor signature: constructor_with_minter(name: string, symbol: string, decimals: u8, minter: AztecAddress, upgrade_authority: AztecAddress)
  const receipt = await TokenContract.deployWithOpts(
    { wallet: deployer, method: 'constructor_with_minter' },
    'Yield Token', // name
    'YT', // symbol
    18, // decimals
    dripperAddress, // minter (Dripper address)
    AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
  )
    .send({
      contractAddressSalt: salt,
      from: deployer.getAddress(),
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredPFCContract.address),
      },
    })
    .wait({ timeout: 120 });

  console.log(`   ✅ Token deployed at: ${receipt.contract.address.toString()}`);

  return {
    contractAddress: receipt.contract.address.toString(),
    deployerAddress: deployer.getAddress().toString(),
    deploymentSalt: salt.toString(),
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

async function writeDeploymentConfig(network: NetworkType, deploymentInfo: DeploymentInfo) {
  const configFilePath = path.join(import.meta.dirname, `../src/config/deployments/${network}.json`);
  
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

  const pxe = await setupPXE();

  // Register the SponsoredFPC contract (for sponsored fee payments)
  await pxe.registerContract({
    instance: await getSponsoredPFCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

  // Create a new account
  console.log('👤 Setting up deployer account...');
  const { wallet } = await createAccount(pxe);
  console.log(`   ✅ Deployer: ${wallet.getAddress().toString()}\n`);

  // Deploy the Dripper contract first
  const dripperDeploymentInfo = await deployDripperContract(pxe, wallet);

  // Deploy the Token contract with Dripper as minter
  const tokenDeploymentInfo = await deployTokenContract(
    pxe,
    wallet,
    AztecAddress.fromString(dripperDeploymentInfo.contractAddress)
  );

  // Save the deployment info to JSON config file
  await writeDeploymentConfig(NETWORK, {
    dripperContract: {
      address: dripperDeploymentInfo.contractAddress,
      salt: dripperDeploymentInfo.deploymentSalt,
    },
    tokenContract: {
      address: tokenDeploymentInfo.contractAddress,
      salt: tokenDeploymentInfo.deploymentSalt,
    },
    deployer: dripperDeploymentInfo.deployerAddress,
  });

  // Clean up the PXE store
  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
}

createAccountAndDeployContract().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});

export { createAccountAndDeployContract };
