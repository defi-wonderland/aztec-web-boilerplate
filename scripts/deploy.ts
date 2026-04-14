import 'dotenv/config';
import { DripperContractArtifact } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { TokenContractArtifact } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { NO_FROM } from '@aztec/aztec.js/account';
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
import {
  ContractInitializationStatus,
  type Wallet,
} from '@aztec/aztec.js/wallet';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import fs from 'fs';
import path from 'path';
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
const PROVER_ENABLED =
  process.env.VITE_PROVER_ENABLED !== undefined
    ? process.env.VITE_PROVER_ENABLED.toLowerCase() === 'true'
    : NETWORK !== 'sandbox';
const FPC_ENABLED = process.env.VITE_FPC_ENABLED !== 'false';

const DEPLOY_TIMEOUT = 960;

async function getSponsoredFPCContract() {
  return getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: new Fr(SPONSORED_FPC_SALT) }
  );
}

async function getSponsoredFeePaymentMethod() {
  const sponsoredPFCContract = await getSponsoredFPCContract();
  return new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
}

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
    return getDefaultCredentials();
  }
}

async function createAccount(wallet: EmbeddedWallet) {
  console.log('👤 Setting up deployer account...');

  const { secretKey, salt, signingKey } = await generateCredentials();
  console.log('   Credentials generated:');
  console.log(`   - Secret Key: ${secretKey.toString().slice(0, 20)}...`);
  console.log(`   - Salt: ${salt.toString().slice(0, 20)}...`);

  const manager = await wallet.createECDSARAccount(secretKey, salt, signingKey);
  const accountAddress = manager.address;

  console.log(`   ✅ Account created: ${accountAddress.toString()}`);

  const metadata = await wallet.getContractMetadata(accountAddress);
  if (
    metadata.initializationStatus !== ContractInitializationStatus.INITIALIZED
  ) {
    console.log('   📦 Deploying account contract...');
    const deployMethod = await manager.getDeployMethod();
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

  return accountAddress;
}

async function deployDripperContract(deployer: Wallet, options: DeployOptions) {
  console.log('📦 Deploying Dripper contract...');

  const salt = Fr.fromString(process.env.VITE_COMMON_SALT || '1337');

  const expectedInstance = await getContractInstanceFromInstantiationParams(
    DripperContractArtifact,
    {
      salt,
      constructorArgs: [],
      deployer: AztecAddress.ZERO,
      publicKeys: PublicKeys.default(),
    }
  );

  const metadata = await deployer.getContractMetadata(expectedInstance.address);
  if (
    metadata.initializationStatus === ContractInitializationStatus.INITIALIZED
  ) {
    await deployer.registerContract(expectedInstance, DripperContractArtifact);
    console.log(
      `   ✅ Dripper already deployed at: ${expectedInstance.address.toString()}`
    );
    return {
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

    return {
      address: contract.address.toString(),
      salt: salt.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Existing nullifier')) {
      await deployer.registerContract(
        expectedInstance,
        DripperContractArtifact
      );
      console.log(
        `   ✅ Dripper already deployed at: ${expectedInstance.address.toString()}`
      );
      return {
        address: expectedInstance.address.toString(),
        salt: salt.toString(),
      };
    }
    throw error;
  }
}

async function deployTokenContract(
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
    dripperAddress, // minter
  ];

  const expectedInstance = await getContractInstanceFromInstantiationParams(
    TokenContractArtifact,
    {
      salt,
      constructorArgs,
      deployer: AztecAddress.ZERO,
      publicKeys: PublicKeys.default(),
      constructorArtifact: 'constructor_with_minter',
    }
  );

  const metadata = await deployer.getContractMetadata(expectedInstance.address);
  if (
    metadata.initializationStatus === ContractInitializationStatus.INITIALIZED
  ) {
    await deployer.registerContract(expectedInstance, TokenContractArtifact);
    console.log(
      `   ✅ Token already deployed at: ${expectedInstance.address.toString()}`
    );
    return {
      address: expectedInstance.address.toString(),
      salt: salt.toString(),
    };
  }

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

    return {
      address: contract.address.toString(),
      salt: salt.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Existing nullifier')) {
      await deployer.registerContract(expectedInstance, TokenContractArtifact);
      console.log(
        `   ✅ Token already deployed at: ${expectedInstance.address.toString()}`
      );
      return {
        address: expectedInstance.address.toString(),
        salt: salt.toString(),
      };
    }
    throw error;
  }
}

interface DeploymentInfo {
  dripperContract: { address: string; salt: string };
  tokenContract: { address: string; salt: string };
  deployer: string;
}

async function writeDeploymentConfig(
  network: NetworkType,
  deploymentInfo: DeploymentInfo
) {
  const configDir = path.join(import.meta.dirname, `../src/config/deployments`);
  const configFilePath = path.join(configDir, `${network}.json`);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const config = {
    network,
    nodeUrl: AZTEC_NODE_URL,
    dripperContract: deploymentInfo.dripperContract,
    tokenContract: deploymentInfo.tokenContract,
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

  console.log(`\n🔧 Setting up wallet for ${NETWORK}...`);
  console.log(`   Node URL: ${AZTEC_NODE_URL}`);
  console.log(`   Prover: ${PROVER_ENABLED ? 'enabled' : 'disabled'}\n`);

  const wallet = await EmbeddedWallet.create(AZTEC_NODE_URL, {
    ephemeral: true,
    pxeConfig: { proverEnabled: PROVER_ENABLED },
  });

  try {
    // Register the SponsoredFPC contract (for sponsored fee payments)
    if (FPC_ENABLED) {
      const sponsoredFPC = await getSponsoredFPCContract();
      await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    } else {
      console.log('⏭️ FPC disabled — skipping SponsoredFPC registration');
    }

    // Create and (if needed) deploy the deployer account
    const deployerAddress = await createAccount(wallet);

    const deployOptions: DeployOptions = {
      from: deployerAddress,
    };

    // Deploy the Dripper contract first
    const dripperDeploymentInfo = await deployDripperContract(
      wallet,
      deployOptions
    );

    // Deploy the Token contract with Dripper as minter
    const tokenDeploymentInfo = await deployTokenContract(
      wallet,
      deployOptions,
      AztecAddress.fromString(dripperDeploymentInfo.address)
    );

    await writeDeploymentConfig(NETWORK, {
      dripperContract: dripperDeploymentInfo,
      tokenContract: tokenDeploymentInfo,
      deployer: deployerAddress.toString(),
    });
  } finally {
    await wallet.stop();
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
