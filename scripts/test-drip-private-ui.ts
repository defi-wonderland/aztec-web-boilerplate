/**
 * This test mimics EXACTLY what the UI does:
 * - Uses contracts from sandbox.json (same as UI)
 * - Uses the same contract registration flow
 * - Uses the same drip_to_private call
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE } from '@aztec/pxe/server';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';
import { createStore } from '@aztec/kv-store/lmdb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';

import {
  DripperContractArtifact,
  DripperContract,
} from '../src/artifacts/Dripper';
import { TokenContractArtifact, TokenContract } from '../src/artifacts/Token';
import { MinimalWallet } from './utils/MinimalWallet';

// Config - matching UI
const AZTEC_NODE_URL = 'http://localhost:8080';
const PROVER_ENABLED = true;
const DRIP_AMOUNT = 1000n;
const TX_TIMEOUT = 600;

const PXE_STORE_DIR = path.join(import.meta.dirname, '.test-ui-store');

// Load sandbox.json - SAME as UI
const loadDeploymentConfig = () => {
  const configPath = path.join(
    import.meta.dirname,
    '../src/config/deployments/sandbox.json'
  );
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
};

async function setupPXE() {
  console.log('\n🔧 Setting up PXE (same config as UI)...');
  console.log(`   Node URL: ${AZTEC_NODE_URL}`);
  console.log(`   Prover: ${PROVER_ENABLED ? 'enabled' : 'disabled'}\n`);

  const aztecNode = createAztecNodeClient(AZTEC_NODE_URL);
  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });

  const store = await createStore('pxe-ui-test', {
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
  return await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: new Fr(SPONSORED_FPC_SALT) }
  );
}

async function getSponsoredFeePaymentMethod() {
  const contract = await getSponsoredFPCContract();
  return new SponsoredFeePaymentMethod(contract.address);
}

async function createTestAccount(pxe: PXE, node: AztecNode) {
  console.log('👤 Creating test account...');

  const secretKey = Fr.random();
  const salt = Fr.random();
  const signingKey = Buffer.alloc(32, Fr.random().toBuffer());

  const wallet = new MinimalWallet(pxe, node);
  const accountContract = new EcdsaRAccountContract(signingKey);
  const manager = await AccountManager.create(wallet, secretKey, accountContract, salt);
  const account = await manager.getAccount();
  const instance = manager.getInstance();
  const artifact = await manager.getAccountContract().getContractArtifact();

  // Register the contract with wallet - same pattern as deploy.ts
  await wallet.registerContract(instance, artifact, manager.getSecretKey());
  wallet.addAccount(account);

  console.log(`   ✅ Account: ${account.getAddress().toString()}`);

  const metadata = await wallet.getContractMetadata(account.getAddress());
  if (!metadata.isContractInitialized) {
    console.log('   📦 Deploying account...');
    const feeMethod = await getSponsoredFeePaymentMethod();
    const deployMethod = await manager.getDeployMethod();
    const deployOpts = {
      from: AztecAddress.ZERO,
      contractAddressSalt: salt,
      fee: { paymentMethod: feeMethod },
      universalDeploy: true,
      skipClassRegistration: true,
      skipPublicDeployment: true,
    };
    await deployMethod.send(deployOpts).wait({ timeout: TX_TIMEOUT });
    console.log('   ✅ Account deployed');
  }

  return { wallet, account };
}

/**
 * Register contracts EXACTLY like the UI does via AztecContractService
 */
async function registerContractsLikeUI(
  pxe: PXE,
  config: ReturnType<typeof loadDeploymentConfig>
) {
  console.log('\n📦 Registering contracts (same as UI)...');

  const dripperAddress = AztecAddress.fromString(config.dripperContract.address);
  const tokenAddress = AztecAddress.fromString(config.tokenContract.address);
  const salt = new Fr(BigInt(config.dripperContract.salt));

  // Register Dripper - same as AztecContractService.registerContract
  console.log('   Registering Dripper...');
  const dripperInstance = await getContractInstanceFromInstantiationParams(
    DripperContractArtifact,
    {
      constructorArgs: [],
      salt: salt,
      constructorArtifact: 'constructor',
      deployer: AztecAddress.ZERO, // Universal deploy
    }
  );

  console.log(`   Computed: ${dripperInstance.address.toString()}`);
  console.log(`   Expected: ${dripperAddress.toString()}`);
  console.log(`   Match: ${dripperInstance.address.equals(dripperAddress)}`);

  await pxe.registerContract({
    instance: dripperInstance,
    artifact: DripperContractArtifact,
  });
  console.log('   ✅ Dripper registered');

  // Register Token - same as AztecContractService.registerContract
  console.log('   Registering Token...');
  const tokenInstance = await getContractInstanceFromInstantiationParams(
    TokenContractArtifact,
    {
      constructorArgs: [
        'Yield Token',
        'YT',
        18,
        dripperInstance.address,
        AztecAddress.ZERO,
      ],
      salt: salt,
      constructorArtifact: 'constructor_with_minter',
      deployer: AztecAddress.ZERO, // Universal deploy
    }
  );

  console.log(`   Computed: ${tokenInstance.address.toString()}`);
  console.log(`   Expected: ${tokenAddress.toString()}`);
  console.log(`   Match: ${tokenInstance.address.equals(tokenAddress)}`);

  if (!tokenInstance.address.equals(tokenAddress)) {
    console.log('\n   ❌ TOKEN ADDRESS MISMATCH!');
    console.log('   This is likely why the UI fails - artifacts may be out of sync');
    throw new Error('Token address mismatch - UI would fail here too');
  }

  await pxe.registerContract({
    instance: tokenInstance,
    artifact: TokenContractArtifact,
  });
  console.log('   ✅ Token registered');

  return { dripperAddress, tokenAddress };
}

async function testDripToPrivateLikeUI() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           DRIP TO PRIVATE TEST (UI MIRROR)                     ║
║           Using SAME contracts as sandbox.json                 ║
╚════════════════════════════════════════════════════════════════╝
`);

  const config = loadDeploymentConfig();
  console.log('📋 Using deployment config:');
  console.log(`   Dripper: ${config.dripperContract.address}`);
  console.log(`   Token: ${config.tokenContract.address}`);
  console.log(`   Deployer: ${config.deployer}`);
  console.log(`   Salt: ${config.dripperContract.salt}`);

  const { pxe, aztecNode } = await setupPXE();

  await pxe.registerContract({
    instance: await getSponsoredFPCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

  const { wallet, account } = await createTestAccount(pxe, aztecNode);

  // Register contracts exactly like UI
  const { dripperAddress, tokenAddress } = await registerContractsLikeUI(pxe, config);

  // Get typed contract instances
  const dripper = await DripperContract.at(dripperAddress, wallet);
  const token = await TokenContract.at(tokenAddress, wallet);

  // Call drip_to_private EXACTLY like useDripper.ts
  console.log(`\n🚀 Calling drip_to_private (same as UI)...`);
  console.log(`   Amount: ${DRIP_AMOUNT}`);
  console.log(`   From: ${account.getAddress().toString()}`);
  console.log(`   Token: ${tokenAddress.toString()}`);

  const startTime = Date.now();
  console.log('\n⏳ Generating ClientIVC proof...');

  try {
    const feeMethod = await getSponsoredFeePaymentMethod();

    // This is EXACTLY the call from useDripper.ts lines 176-182
    await dripper.methods
      .drip_to_private(token.address, DRIP_AMOUNT)
      .send({
        from: account.getAddress(),
        fee: { paymentMethod: feeMethod },
      })
      .wait({ timeout: TX_TIMEOUT });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ drip_to_private SUCCESSFUL!`);
    console.log(`   Duration: ${duration}s`);
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    TEST PASSED ✅                               ║
║  drip_to_private works - UI should work too!                  ║
╚════════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ FAILED after ${duration}s:`, error);
    throw error;
  } finally {
    fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
  }
}

testDripToPrivateLikeUI().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
