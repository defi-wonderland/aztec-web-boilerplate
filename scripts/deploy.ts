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

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || 'http://localhost:8080';
const PROVER_ENABLED = process.env.PROVER_ENABLED === 'false' ? false : true;
const WRITE_ENV_FILE = process.env.WRITE_ENV_FILE === 'false' ? false : true;

const PXE_STORE_DIR = path.join(import.meta.dirname, '.store');

async function setupPXE() {
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

  return {
    contractAddress: receipt.contract.address.toString(),
    deployerAddress: deployer.getAddress().toString(),
    deploymentSalt: salt.toString(),
  };
}

async function deployTokenContract(pxe: PXE, deployer: Wallet, dripperAddress: AztecAddress) {
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

  return {
    contractAddress: receipt.contract.address.toString(),
    deployerAddress: deployer.getAddress().toString(),
    deploymentSalt: salt.toString(),
  };
}

async function writeEnvFile(deploymentInfo) {
  const envFilePath = path.join(import.meta.dirname, '../.env');
  const envConfig = Object.entries(deploymentInfo)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(envFilePath, envConfig);

  console.log(`
      \n\n\n
      Contracts deployed successfully. Config saved to ${envFilePath}
      IMPORTANT: Do not lose this file as you will not be able to recover the contract addresses if you lose it.
      \n\n\n
    `);
}

async function createAccountAndDeployContract() {
  const pxe = await setupPXE();

  // Register the SponsoredFPC contract (for sponsored fee payments)
  await pxe.registerContract({
    instance: await getSponsoredPFCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

  // Create a new account
  const { wallet, /* signingKey */ } = await createAccount(pxe);

  // Deploy the Dripper contract first
  const dripperDeploymentInfo = await deployDripperContract(pxe, wallet);

  // Deploy the Token contract with Dripper as minter
  const tokenDeploymentInfo = await deployTokenContract(pxe, wallet, AztecAddress.fromString(dripperDeploymentInfo.contractAddress));

  // Save the deployment info to .env file (VITE_ prefix for frontend access)
  if (WRITE_ENV_FILE) {
    await writeEnvFile({
      // Vite env vars (accessible in frontend)
      VITE_DRIPPER_CONTRACT_ADDRESS: dripperDeploymentInfo.contractAddress,
      VITE_TOKEN_CONTRACT_ADDRESS: tokenDeploymentInfo.contractAddress,
      VITE_DEPLOYER_ADDRESS: dripperDeploymentInfo.deployerAddress,
      VITE_DRIPPER_DEPLOYMENT_SALT: dripperDeploymentInfo.deploymentSalt,
      VITE_TOKEN_DEPLOYMENT_SALT: tokenDeploymentInfo.deploymentSalt,
      VITE_AZTEC_NODE_URL: AZTEC_NODE_URL,
      VITE_PROVER_ENABLED: PROVER_ENABLED.toString(),
    });
  }

  // Clean up the PXE store
  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
}


createAccountAndDeployContract().catch((error) => {
  console.error(error);
  process.exit(1);
});

export { createAccountAndDeployContract };
