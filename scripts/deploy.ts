import fs from 'fs';
import path from 'path';
import {
  AztecAddress,
  createAztecNodeClient,
  DeployMethod,
  Fr,
  getContractInstanceFromDeployParams,
  PublicKeys,
  type PXE,
  SponsoredFeePaymentMethod,
  type Wallet,
} from '@aztec/aztec.js';
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa';
import { createStore } from '@aztec/kv-store/lmdb';
import { getDefaultInitializer } from '@aztec/stdlib/abi';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
// @ts-ignore
import { EasyPrivateVotingContract } from '../src/artifacts/EasyPrivateVoting.ts';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || 'http://localhost:8080';
const PROVER_ENABLED = process.env.PROVER_ENABLED === 'false' ? false : true;
const WRITE_ENV_FILE = process.env.WRITE_ENV_FILE === 'false' ? false : true;

const PXE_STORE_DIR = path.join(import.meta.dirname, '.store');

async function setupPXE() {
  const aztecNode = createAztecNodeClient(AZTEC_NODE_URL);

  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });

  const store = await createStore('pxe', {
    dataDirectory: PXE_STORE_DIR,
    dataStoreMapSizeKB: 1e6,
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
  const instance = await getContractInstanceFromDeployParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  return instance;
}

async function createAccount(pxe: PXE) {
  const salt = Fr.random();
  const secretKey = Fr.random();
  const signingKey = Buffer.alloc(32, Fr.random().toBuffer());
  const ecdsaAccount = await getEcdsaRAccount(pxe, secretKey, signingKey, salt);

  const deployMethod = await ecdsaAccount.getDeployMethod();
  const sponsoredPFCContract = await getSponsoredPFCContract();
  const deployOpts = {
    contractAddressSalt: Fr.fromString(ecdsaAccount.salt.toString()),
    fee: {
      paymentMethod: await ecdsaAccount.getSelfPaymentMethod(
        new SponsoredFeePaymentMethod(sponsoredPFCContract.address)
      ),
    },
    universalDeploy: true,
    skipClassRegistration: true,
    skipPublicDeployment: true,
  };
  const provenInteraction = await deployMethod.prove(deployOpts);
  await provenInteraction.send().wait({ timeout: 120 });

  await ecdsaAccount.register();
  const wallet = await ecdsaAccount.getWallet();

  return {
    wallet,
    signingKey,
  };
}

async function deployContract(pxe: PXE, deployer: Wallet) {
  const salt = Fr.random();
  const contract = await getContractInstanceFromDeployParams(
    EasyPrivateVotingContract.artifact,
    {
      publicKeys: PublicKeys.default(),
      constructorArtifact: getDefaultInitializer(
        EasyPrivateVotingContract.artifact
      ),
      constructorArgs: [deployer.getAddress().toField()],
      deployer: deployer.getAddress(),
      salt,
    }
  );

  const deployMethod = new DeployMethod(
    contract.publicKeys,
    deployer,
    EasyPrivateVotingContract.artifact,
    (address: AztecAddress, wallet: Wallet) =>
      EasyPrivateVotingContract.at(address, wallet),
    [deployer.getAddress().toField()],
    getDefaultInitializer(EasyPrivateVotingContract.artifact)?.name
  );

  const sponsoredPFCContract = await getSponsoredPFCContract();

  const provenInteraction = await deployMethod.prove({
    contractAddressSalt: salt,
    fee: {
      paymentMethod: new SponsoredFeePaymentMethod(
        sponsoredPFCContract.address
      ),
    },
  });
  await provenInteraction.send().wait({ timeout: 120 });
  await pxe.registerContract({
    instance: contract,
    artifact: EasyPrivateVotingContract.artifact,
  });

  return {
    contractAddress: contract.address.toString(),
    deployerAddress: deployer.getAddress().toString(),
    deploymentSalt: salt.toString(),
  };
}

async function deployDripperContract(pxe: PXE, deployer: Wallet) {
  const salt = Fr.random();
  const contract = await getContractInstanceFromDeployParams(
    DripperContract.artifact,
    {
      publicKeys: PublicKeys.default(),
      constructorArtifact: getDefaultInitializer(
        DripperContract.artifact
      ),
      constructorArgs: [],
      deployer: deployer.getAddress(),
      salt,
    }
  );

  const deployMethod = new DeployMethod(
    contract.publicKeys,
    deployer,
    DripperContract.artifact,
    (address: AztecAddress, wallet: Wallet) =>
      DripperContract.at(address, wallet),
    [],
    getDefaultInitializer(DripperContract.artifact)?.name
  );

  const sponsoredPFCContract = await getSponsoredPFCContract();

  const provenInteraction = await deployMethod.prove({
    contractAddressSalt: salt,
    fee: {
      paymentMethod: new SponsoredFeePaymentMethod(
        sponsoredPFCContract.address
      ),
    },
  });
  await provenInteraction.send().wait({ timeout: 120 });
  await pxe.registerContract({
    instance: contract,
    artifact: DripperContract.artifact,
  });

  return {
    contractAddress: contract.address.toString(),
    deployerAddress: deployer.getAddress().toString(),
    deploymentSalt: salt.toString(),
  };
}

async function deployTokenContract(pxe: PXE, deployer: Wallet, dripperAddress: AztecAddress) {
  const salt = Fr.random();

  // Use the deployWithOpts method to specify constructor_with_minter
  const deployMethod = TokenContract.deployWithOpts(
    {
      wallet: deployer,
      method: 'constructor_with_minter',
    },
    'Yield Token', // name
    'YT', // symbol
    18, // decimals
    dripperAddress, // minter (Dripper address)
    AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
  );

  const sponsoredPFCContract = await getSponsoredPFCContract();

  const provenInteraction = await deployMethod.prove({
    contractAddressSalt: salt,
    fee: {
      paymentMethod: new SponsoredFeePaymentMethod(
        sponsoredPFCContract.address
      ),
    },
  });
  const receipt = await provenInteraction.send().wait({ timeout: 120 });

  // Get the deployed contract address from the receipt
  const deployedAddress = receipt.contract.address;

  // Create contract instance for registration
  const deployedContract = await getContractInstanceFromDeployParams(
    TokenContract.artifact,
    {
      publicKeys: PublicKeys.default(),
      constructorArtifact: 'constructor_with_minter',
      constructorArgs: [
        'Yield Token', // name
        'YT', // symbol
        18, // decimals
        dripperAddress.toField(), // minter (Dripper address) - convert to Field
        AztecAddress.ZERO.toField(), // upgrade_authority (zero address for non-upgradeable) - convert to Field
      ],
      deployer: deployer.getAddress(),
      salt,
    }
  );

  await pxe.registerContract({
    instance: deployedContract,
    artifact: TokenContract.artifact,
  });

  return {
    contractAddress: deployedAddress.toString(),
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

  // // Save the wallet info
  // const walletInfo = {
  //   address: wallet.getAddress().toString(),
  //   salt: wallet.salt.toString(),
  //   secretKey: wallet.getSecretKey().toString(),
  //   signingKey: Buffer.from(signingKey).toString('hex'),
  // };
  // fs.writeFileSync(
  //   path.join(import.meta.dirname, '../wallet-info.json'),
  //   JSON.stringify(walletInfo, null, 2)
  // );
  // console.log('\n\n\nWallet info saved to wallet-info.json\n\n\n');

  // Deploy the contract
  const deploymentInfo = await deployContract(pxe, wallet);

  // Deploy the Dripper contract first
  const dripperDeploymentInfo = await deployDripperContract(pxe, wallet);

  // Deploy the Token contract with Dripper as minter
  const tokenDeploymentInfo = await deployTokenContract(pxe, wallet, AztecAddress.fromString(dripperDeploymentInfo.contractAddress));


  
  // Save the deployment info to .env file
  if (WRITE_ENV_FILE) {
    await writeEnvFile({
      CONTRACT_ADDRESS: deploymentInfo.contractAddress,
      DRIPPER_CONTRACT_ADDRESS: dripperDeploymentInfo.contractAddress,
      TOKEN_CONTRACT_ADDRESS: tokenDeploymentInfo.contractAddress,
      DEPLOYER_ADDRESS: deploymentInfo.deployerAddress,
      DEPLOYMENT_SALT: deploymentInfo.deploymentSalt,
      DRIPPER_DEPLOYMENT_SALT: dripperDeploymentInfo.deploymentSalt,
      TOKEN_DEPLOYMENT_SALT: tokenDeploymentInfo.deploymentSalt,
      AZTEC_NODE_URL,
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
