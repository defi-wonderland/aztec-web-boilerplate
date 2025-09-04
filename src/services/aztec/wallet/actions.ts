import { type AccountWallet, Fr } from '@aztec/aztec.js';
import { AztecWalletService, AztecContractService } from '../core';
import { AztecDripperService, AztecTokenService } from '../features';
import { AztecStorageService } from '../storage';
import { WalletServices } from './initialization';
import { AppConfig } from '../../../config/networks';

export interface WalletActionServices {
  dripperService: AztecDripperService;
  tokenService: AztecTokenService;
}

export const createWalletActionServices = (
  walletServices: WalletServices,
  config: AppConfig,
  getConnectedAccount: () => AccountWallet | null
): WalletActionServices => {
  const dripperService = new AztecDripperService(
    () => walletServices.walletService.getSponsoredFeePaymentMethod(),
    config.dripperContractAddress,
    getConnectedAccount
  );

  const tokenService = new AztecTokenService(getConnectedAccount);

  return {
    dripperService,
    tokenService,
  };
};

export const createAccount = async (
  walletServices: WalletServices,
  setIsDeploying: (deploying: boolean) => void,
  addMessage?: (message: any) => void,
  config?: AppConfig
): Promise<AccountWallet> => {
  const result = await walletServices.walletService.createEcdsaAccount();
  
  // Clear any existing account and save the new one to storage
  walletServices.storageService.clearAccount();
  walletServices.storageService.saveAccount({
    address: result.wallet.getAddress().toString(),
    signingKey: result.signingKey.toString('hex'),
    secretKey: result.secretKey.toString(),
    salt: result.salt.toString(),
  });

  // Deploy the account in the background using worker if deployment worker is available
  if (typeof Worker !== 'undefined' && setIsDeploying) {
    setIsDeploying(true);
    
    try {
      // Import worker client dynamically to avoid issues in environments without Worker support
      const { AccountDeployWorkerClient } = await import('../../../workers/accountDeployClient');
      const deployWorker = new AccountDeployWorkerClient();
      
      deployWorker.deploy(
        {
          nodeUrl: config?.nodeUrl || 'http://localhost:8080',
          secretKey: result.secretKey.toString(),
          signingKeyHex: result.signingKey.toString('hex'),
          salt: result.salt.toString(),
        },
        {
          onSuccess: (response: any) => {
            console.log('✅ Account deployed successfully', response.payload);
            setIsDeploying(false);
          },
          onError: (error: string) => {
            // Check if the error is due to account already being deployed
            if (
              error.includes('Existing nullifier') ||
              error.includes('Invalid tx: Existing nullifier')
            ) {
              console.log('✅ Account was already deployed');
              setIsDeploying(false);
            } else {
              console.error('❌ Failed to deploy account in background:', error);
              if (addMessage) {
                addMessage({
                  message: 'Failed to deploy account in background',
                  type: 'error',
                  source: 'wallet',
                  details: error,
                });
              }
              setIsDeploying(false);
            }
          },
        }
      );
    } catch (workerError) {
      console.error('❌ Failed to initialize deployment worker:', workerError);
      setIsDeploying(false);
    }
  }

  return result.wallet;
};

export const connectTestAccount = async (
  walletService: AztecWalletService,
  index: number
): Promise<AccountWallet> => {
  return await walletService.connectTestAccount(index);
};

export const connectExistingAccount = async (
  walletServices: WalletServices,
  setIsDeploying: (deploying: boolean) => void,
  addMessage?: (message: any) => void,
  config?: AppConfig
): Promise<AccountWallet | null> => {
  const account = walletServices.storageService.getAccount();
  if (!account) {
    return null;
  }

  const wallet = await walletServices.walletService.createEcdsaAccountFromCredentials(
    Fr.fromString(account.secretKey),
    Buffer.from(account.signingKey, 'hex'),
    Fr.fromString(account.salt)
  );

  // Deploy the existing account in the background using worker if available
  if (typeof Worker !== 'undefined' && setIsDeploying) {
    setIsDeploying(true);
    
    try {
      // Import worker client dynamically to avoid issues in environments without Worker support
      const { AccountDeployWorkerClient } = await import('../../../workers/accountDeployClient');
      const deployWorker = new AccountDeployWorkerClient();
      
      deployWorker.deploy(
        {
          nodeUrl: config?.nodeUrl || 'http://localhost:8080',
          secretKey: account.secretKey,
          signingKeyHex: account.signingKey,
          salt: account.salt,
        },
        {
          onSuccess: (response: any) => {
            console.log('✅ Existing account deployed successfully', response.payload);
            setIsDeploying(false);
          },
          onError: (error: string) => {
            // Check if the error is due to account already being deployed
            if (
              error.includes('Existing nullifier') ||
              error.includes('Invalid tx: Existing nullifier')
            ) {
              console.log('✅ Existing account was already deployed');
            } else {
              console.error('❌ Failed to deploy existing account in background:', error);
              if (addMessage) {
                addMessage({
                  message: 'Failed to deploy existing account in background',
                  type: 'error',
                  source: 'wallet',
                  details: error,
                });
              }
            }
            setIsDeploying(false);
          },
        }
      );
    } catch (workerError) {
      console.error('❌ Failed to initialize deployment worker:', workerError);
      setIsDeploying(false);
    }
  }

  return wallet;
};
