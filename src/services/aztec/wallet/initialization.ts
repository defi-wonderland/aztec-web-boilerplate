import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AztecWalletService } from '../core';
import { AztecStorageService } from '../storage';

/**
 * Wallet services returned from initialization.
 * 
 * Note: Contract registration is now handled separately via AztecContractProvider.
 * Use the useContract or useContractRegistry hooks to access registered contracts.
 */
export interface WalletServices {
  storageService: AztecStorageService;
  walletService: AztecWalletService;
}

/**
 * Initialize wallet services (PXE connection and storage).
 * 
 * Contract registration is handled separately by AztecContractProvider
 * which provides lazy/eager loading capabilities and PXE persistence checks.
 * 
 * @example
 * ```tsx
 * // In your provider setup:
 * const services = await initializeWalletServices(nodeUrl, 'sandbox');
 * 
 * // Then wrap with AztecContractProvider to register contracts:
 * <AztecContractProvider
 *   contracts={aztecContracts}
 *   pxe={services.walletService.getPXE()}
 *   config={config}
 * >
 *   {children}
 * </AztecContractProvider>
 * ```
 */
export const initializeWalletServices = async (
  nodeUrl: string,
  networkName?: string
): Promise<WalletServices> => {
  // Initialize storage service
  const storageService = new AztecStorageService();

  // Initialize wallet service (creates PXE connection)
  const walletService = new AztecWalletService();
  await walletService.initialize(nodeUrl, networkName);

  // Register saved senders with PXE
  await registerSavedSenders(walletService, storageService);

  return {
    storageService,
    walletService,
  };
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
