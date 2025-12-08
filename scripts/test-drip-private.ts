import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
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
import { DripperContractArtifact, DripperContract } from '../src/artifacts/Dripper';
import { TokenContractArtifact, TokenContract } from '../src/artifacts/Token';
import { MinimalWallet } from './utils/MinimalWallet';

// Config
const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || 'http://localhost:8080';
const PROVER_ENABLED = true; // Always test with prover enabled
const DRIP_AMOUNT = 1000n;
const TX_TIMEOUT = 600; // 10 minutes for proof generation

const PXE_STORE_DIR = path.join(import.meta.dirname, '.test-store');

// Load sandbox deployment so we mirror UI contract addresses/salts
const loadDeploymentConfig = () => {
  const configPath = path.join(import.meta.dirname, '../src/config/deployments/sandbox.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
};

async function setupPXE() {
  console.log('\n🔧 Setting up PXE...');
  console.log(`   Node URL: ${AZTEC_NODE_URL}`);
  console.log(`   Prover: ${PROVER_ENABLED ? 'enabled' : 'disabled'}\n`);

  const aztecNode = createAztecNodeClient(AZTEC_NODE_URL);

  // Clean up old store
  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });

  const store = await createStore('pxe-test', {
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
  const sponsoredFPCContract = await getSponsoredFPCContract();
  return new SponsoredFeePaymentMethod(sponsoredFPCContract.address);
};

async function generateCredentials() {
  // Generate fresh random credentials for test
  return {
    salt: Fr.random(),
    secretKey: Fr.random(),
    signingKey: Buffer.alloc(32, Fr.random().toBuffer()),
  };
}

async function createTestAccount(pxe: PXE, node: AztecNode) {
  console.log('👤 Creating test account...');

  const { secretKey, salt, signingKey } = await generateCredentials();

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
    await deployMethod.send(deployOpts).wait({ timeout: TX_TIMEOUT });
    console.log('   ✅ Account deployed');
  } else {
    console.log('   ✅ Account already deployed');
  }

  return { wallet, account, manager };
}

/**
 * Register contracts from sandbox.json exactly like the UI flow.
 */
async function registerContractsFromSandbox(
  pxe: PXE,
  config: ReturnType<typeof loadDeploymentConfig>
): Promise<{ dripperAddress: AztecAddress; tokenAddress: AztecAddress }> {
  console.log('\n📦 Registering contracts from sandbox.json (UI parity)...');

  const dripperAddress = AztecAddress.fromString(config.dripperContract.address);
  const tokenAddress = AztecAddress.fromString(config.tokenContract.address);
  const salt = new Fr(BigInt(config.dripperContract.salt));

  // Dripper registration (matches AztecContractService.registerContract)
  console.log('   Registering Dripper...');
  const dripperInstance = await getContractInstanceFromInstantiationParams(DripperContractArtifact, {
    constructorArgs: [],
    salt,
    constructorArtifact: 'constructor',
    deployer: AztecAddress.ZERO,
  });

  if (!dripperInstance.address.equals(dripperAddress)) {
    throw new Error(
      `Dripper address mismatch. Expected ${dripperAddress.toString()} got ${dripperInstance.address.toString()}`
    );
  }

  await pxe.registerContract({
    instance: dripperInstance,
    artifact: DripperContractArtifact,
  });
  console.log('   ✅ Dripper registered');

  // Token registration (matches AztecContractService.registerContract)
  console.log('   Registering Token...');
  const tokenInstance = await getContractInstanceFromInstantiationParams(TokenContractArtifact, {
    constructorArgs: ['Yield Token', 'YT', 18, dripperInstance.address, AztecAddress.ZERO],
    salt,
    constructorArtifact: 'constructor_with_minter',
    deployer: AztecAddress.ZERO,
  });

  if (!tokenInstance.address.equals(tokenAddress)) {
    throw new Error(
      `Token address mismatch. Expected ${tokenAddress.toString()} got ${tokenInstance.address.toString()}`
    );
  }

  await pxe.registerContract({
    instance: tokenInstance,
    artifact: TokenContractArtifact,
  });
  console.log('   ✅ Token registered');

  return { dripperAddress, tokenAddress };
}

async function testDripToPrivate() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           DRIP TO PRIVATE TEST                                 ║
║           Prover: ENABLED                                      ║
╚════════════════════════════════════════════════════════════════╝
`);

  const deploymentConfig = loadDeploymentConfig();
  console.log('📋 Using sandbox deployment config:');
  console.log(`   Dripper: ${deploymentConfig.dripperContract.address}`);
  console.log(`   Token: ${deploymentConfig.tokenContract.address}`);
  console.log(`   Salt: ${deploymentConfig.dripperContract.salt}`);

  const { pxe, aztecNode } = await setupPXE();

  // Register the SponsoredFPC contract
  await pxe.registerContract({
    instance: await getSponsoredFPCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

  // Create test account
  const { wallet, account } = await createTestAccount(pxe, aztecNode);

  // Register existing contracts from sandbox.json (UI parity)
  const { dripperAddress, tokenAddress } = await registerContractsFromSandbox(pxe, deploymentConfig);

  // Get contract instances at registered addresses
  const dripper = (await Contract.at(dripperAddress, DripperContractArtifact, wallet)) as DripperContract;
  const token = (await Contract.at(tokenAddress, TokenContractArtifact, wallet)) as TokenContract;

  // Test drip_to_private
  console.log(`\n🚀 Testing drip_to_private...`);
  console.log(`   Amount: ${DRIP_AMOUNT}`);
  console.log(`   From: ${account.getAddress().toString()}`);
  console.log(`   Token: ${token.address.toString()}`);

  const startTime = Date.now();
  console.log('\n⏳ Generating ClientIVC proof (this may take several minutes)...');

  try {
    const sponsoredFeePaymentMethod = await getSponsoredFeePaymentMethod();
    
    const tx = dripper.methods
      .drip_to_private(token.address, DRIP_AMOUNT)
      .send({
        from: account.getAddress(),
        fee: { paymentMethod: sponsoredFeePaymentMethod },
      });

    console.log(`   📤 Transaction sent, waiting for confirmation...`);
    
    const receipt = await tx.wait({ timeout: TX_TIMEOUT });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ drip_to_private SUCCESSFUL!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Tx Hash: ${receipt.txHash}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Status: ${receipt.status}`);

    // Verify private balance
    console.log('\n📊 Verifying private balance...');
    const privateBalanceResult = await token.methods
      .balance_of_private(account.getAddress())
      .simulate({ from: account.getAddress() });
    const privateBalance = typeof privateBalanceResult === 'bigint'
      ? privateBalanceResult
      : BigInt(privateBalanceResult.toString());

    console.log(`   Private balance detected: ${privateBalance}`);
    if (privateBalance < DRIP_AMOUNT) {
      throw new Error(
        `Private balance too low. Expected at least ${DRIP_AMOUNT}, got ${privateBalance}`
      );
    }
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    TEST PASSED ✅                               ║
║  drip_to_private works with prover enabled!                   ║
╚════════════════════════════════════════════════════════════════╝
`);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ drip_to_private FAILED after ${duration}s`);
    console.error('Error:', error);
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    TEST FAILED ❌                               ║
╚════════════════════════════════════════════════════════════════╝
`);
    throw error;
  } finally {
    // Clean up
    fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
  }
}

testDripToPrivate().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
