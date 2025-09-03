import { AztecAddress, Fr } from '@aztec/aztec.js';
import { AztecWalletService, AztecContractService } from '../core';
import { AztecStorageService } from '../storage';
import { DripperContract } from '../../../artifacts/Dripper';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { TokenContractArtifact as AztecTokenContractArtifact } from '@aztec/noir-contracts.js/Token';
import { AppConfig } from '../../../config/networks';

export interface WalletServices {
  storageService: AztecStorageService;
  walletService: AztecWalletService;
  contractService: AztecContractService;
}

export const initializeWalletServices = async (
  nodeUrl: string,
  config: AppConfig
): Promise<WalletServices> => {
  // Initialize storage service
  const storageService = new AztecStorageService();

  // Initialize wallet service
  const walletService = new AztecWalletService();
  await walletService.initialize(nodeUrl);

  // Initialize contract service
  const contractService = new AztecContractService(walletService.getPXE());

  // Register contracts
  await registerContracts(contractService, config);

  // Register saved senders with PXE
  await registerSavedSenders(walletService, storageService);

  return {
    storageService,
    walletService,
    contractService,
  };
};

const registerContracts = async (
  contractService: AztecContractService,
  config: AppConfig
): Promise<void> => {
  // Register Dripper contract
  const dripperDeploymentSalt = Fr.fromString(config.dripperDeploymentSalt);
  
  await contractService.registerContract(
    DripperContract.artifact,
    AztecAddress.ZERO,
    dripperDeploymentSalt,
    [], // No constructor args for Dripper
    'constructor' // Pass the specific constructor artifact
  );

  // Register Token contract
  const tokenDeploymentSalt = Fr.fromString(config.tokenDeploymentSalt);

  await contractService.registerContract(
    TokenContract.artifact,
    AztecAddress.ZERO,
    tokenDeploymentSalt,
    [
      "Yield Token", // name
      "YT", // symbol
      18, // decimals
      AztecAddress.fromString(config.dripperContractAddress), // minter (Dripper address)
      AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
    ],
    'constructor_with_minter' // Pass the specific constructor artifact
  );

  // Register WETH contract if on testnet
  if (config.isTestnet) {
    try {
      const wethDeploymentSalt = Fr.fromHexString('0x21709ebd7c082ffe19291eca4b0ab5220814dbc07d79e8c876c1a37f3bbf3cd0');
      const wethDeployer = AztecAddress.fromString('0x2103c4465e9d73a7b400576451beae75839e215178c0846120e9ed261ebf4f58');

      await contractService.registerContract(
        AztecTokenContractArtifact,
        wethDeployer,
        wethDeploymentSalt,
        [
          wethDeployer,
          "Wrapped Ethereum",
          "WETH",
          18,
        ],
        'constructor'
      );
    } catch (error) {
      // Don't fail initialization if WETH registration fails
    }
  }
};

const registerSavedSenders = async (
  walletService: AztecWalletService,
  storageService: AztecStorageService
): Promise<void> => {
  try {
    const pxe = walletService.getPXE();
    const savedSenders = storageService.getSenders();
    
    if (savedSenders.length === 0) {
      console.log('No saved senders to register');
      return;
    }
    
    console.log(`Registering ${savedSenders.length} saved senders with PXE...`);
    
    for (const senderAddressString of savedSenders) {
      try {
        const senderAddress = AztecAddress.fromString(senderAddressString);
        await pxe.registerSender(senderAddress);
        console.log(`✅ Registered sender: ${senderAddressString}`);
      } catch (error) {
        // Sender might already be registered, which is fine
        console.warn(`⚠️ Failed to register sender ${senderAddressString}:`, error);
      }
    }
    
    console.log('✅ Finished registering saved senders');
  } catch (error) {
    console.error('❌ Error registering saved senders:', error);
    // Don't throw - this shouldn't block initialization
  }
};
