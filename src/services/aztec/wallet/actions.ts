import { Buffer } from 'buffer';
import { Fr } from '@aztec/aztec.js/fields';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { AztecWalletService } from '../core';
import { WalletServices } from './initialization';
import { AppConfig } from '../../../config/networks';
import type { MessageInfo } from '../../../providers/ErrorProvider';
import { getConfiguredAccountCredentials } from '../../../utils/accountCredentials';

type AddMessageFn = (message: Omit<MessageInfo, 'id' | 'timestamp'>) => void;

export const createAccount = async (
  walletServices: WalletServices,
  setIsDeploying: (deploying: boolean) => void,
  addMessage?: AddMessageFn,
  config?: AppConfig
): Promise<AccountWithSecretKey> => {
  const configuredCredentials = await getConfiguredAccountCredentials();
  const result = await walletServices.walletService.createEcdsaAccount(
    configuredCredentials ?? undefined
  );
  
  // Clear any existing account and save the new one to storage
  // ⚠️ Keys stored in plain text - for testnet only!
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
          onSuccess: (response: unknown) => {
            const payload = response as { status: string; txHash: string | null };
            if (payload.status === 'already_deployed') {
              console.log('✅ Account was already deployed');
            } else {
              console.log('✅ Account deployed successfully', response);
            }
            setIsDeploying(false);
          },
          onError: (error: string) => {
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
): Promise<AccountWithSecretKey> => {
  return await walletService.connectTestAccount(index);
};

export const connectExistingAccount = async (
  walletServices: WalletServices,
  setIsDeploying: (deploying: boolean) => void,
  addMessage?: AddMessageFn,
  config?: AppConfig
): Promise<AccountWithSecretKey | null> => {
  let account = walletServices.storageService.getAccount();
  let wallet: AccountWithSecretKey | null = null;

  if (!account && config?.name === 'devnet') {
    const credentials = await getConfiguredAccountCredentials();
    if (credentials) {
      wallet =
        await walletServices.walletService.createEcdsaAccountFromCredentials(
          credentials.secretKey,
          credentials.signingKey,
          credentials.salt
        );
      account = {
        address: wallet.getAddress().toString(),
        secretKey: credentials.secretKey.toString(),
        signingKey: credentials.signingKey.toString('hex'),
        salt: credentials.salt.toString(),
      };
      walletServices.storageService.saveAccount(account);
    }
  }

  if (!account) {
    return null;
  }

  if (!wallet) {
    wallet =
      await walletServices.walletService.createEcdsaAccountFromCredentials(
        Fr.fromString(account.secretKey),
        Buffer.from(account.signingKey, 'hex'),
        Fr.fromString(account.salt)
      );
  }

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
          onSuccess: (response: unknown) => {
            const payload = response as { status: string; txHash: string | null };
            if (payload.status === 'already_deployed') {
              console.log('✅ Existing account was already deployed');
            } else {
              console.log('✅ Existing account deployed successfully', response);
            }
            setIsDeploying(false);
          },
          onError: (error: string) => {
            console.error('❌ Failed to deploy existing account in background:', error);
            if (addMessage) {
              addMessage({
                message: 'Failed to deploy existing account in background',
                type: 'error',
                source: 'wallet',
                details: error,
              });
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
