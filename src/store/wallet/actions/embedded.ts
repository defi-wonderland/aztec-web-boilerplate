import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { randomBytes } from '@aztec/foundation/crypto/random';
import { SharedPXEService } from '../../../services/aztec/pxe';
import { WalletType } from '../../../types/aztec';
import {
  getConfiguredAccountCredentials,
  hasConfiguredCredentials,
} from '../../../utils/accountCredentials';
import { getNetworkStore } from '../../network';
import type { AccountCredentials } from '../../../types/aztec';
import type { MinimalWallet } from '../../../utils/MinimalWallet';
import type { SetState, GetState } from '../types';

const STORAGE_KEY = 'aztec-embedded-account';

interface StoredAccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

const getSavedAccount = (): StoredAccountData | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveAccount = (data: StoredAccountData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
};

const clearSavedAccount = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
};

const connectWithCredentials = async (
  credentials: AccountCredentials,
  wallet: MinimalWallet,
  set: SetState
): Promise<AccountWithSecretKey> => {
  const accountContract = new EcdsaRAccountContract(credentials.signingKey);
  const accountManager = await AccountManager.create(
    wallet,
    credentials.secretKey,
    accountContract,
    credentials.salt
  );

  const account = await accountManager.getAccount();
  const instance = accountManager.getInstance();
  const artifact = await accountManager
    .getAccountContract()
    .getContractArtifact();
  await wallet.registerContract(
    instance,
    artifact,
    accountManager.getSecretKey()
  );
  wallet.addAccount(account);

  set({
    account,
    walletType: WalletType.EMBEDDED,
    status: 'connected',
  });

  return account;
};

export const createEmbeddedActions = (set: SetState, _get: GetState) => ({
  connectEmbedded: async (): Promise<AccountWithSecretKey> => {
    set({ status: 'connecting', error: null, pxeError: null });

    try {
      const config = getNetworkStore().currentConfig;
      set({ pxeStatus: 'initializing', pxeError: null });
      const pxeInstance = await SharedPXEService.getInstance(
        config.nodeUrl,
        config.name
      );
      set({ pxeStatus: 'ready', pxeError: null });
      const wallet = pxeInstance.wallet;

      const salt = Fr.fromBuffer(randomBytes(32));
      const secretKey = await poseidon2Hash([Fr.fromBuffer(randomBytes(32))]);
      const signingKey = Buffer.from(secretKey.toBuffer().subarray(0, 32));

      const accountContract = new EcdsaRAccountContract(signingKey);
      const accountManager = await AccountManager.create(
        wallet,
        secretKey,
        accountContract,
        salt
      );

      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager
        .getAccountContract()
        .getContractArtifact();
      await wallet.registerContract(
        instance,
        artifact,
        accountManager.getSecretKey()
      );
      wallet.addAccount(account);

      set({ status: 'deploying' });
      try {
        const metadata = await wallet.getContractMetadata(
          accountManager.address
        );
        if (!metadata.isContractInitialized) {
          const deployMethod = await accountManager.getDeployMethod();
          const paymentMethod =
            await pxeInstance.getSponsoredFeePaymentMethod();

          await deployMethod
            .send({
              from: AztecAddress.ZERO,
              fee: { paymentMethod },
              skipClassPublication: true,
              skipInstancePublication: true,
            })
            .wait({ timeout: 120 });
        }
      } catch {
        // Don't throw - account is created, just not deployed
      }

      saveAccount({
        address: accountManager.address.toString(),
        signingKey: signingKey.toString('hex'),
        secretKey: secretKey.toString(),
        salt: salt.toString(),
      });

      set({
        account,
        walletType: WalletType.EMBEDDED,
        status: 'connected',
      });
      return account;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create account';
      set({
        status: 'disconnected',
        error: message,
        pxeStatus: 'error',
        pxeError: message,
      });
      throw err;
    }
  },

  connectExistingEmbedded: async (): Promise<AccountWithSecretKey | null> => {
    set({ status: 'connecting', error: null, pxeError: null });

    try {
      const config = getNetworkStore().currentConfig;
      set({ pxeStatus: 'initializing', pxeError: null });
      const pxeInstance = await SharedPXEService.getInstance(
        config.nodeUrl,
        config.name
      );
      set({ pxeStatus: 'ready', pxeError: null });
      const wallet = pxeInstance.wallet;

      const envCredentials = await getConfiguredAccountCredentials();
      if (envCredentials) {
        const account = await connectWithCredentials(
          envCredentials,
          wallet,
          set
        );
        return account;
      }

      const saved = getSavedAccount();
      if (saved) {
        const credentials: AccountCredentials = {
          secretKey: Fr.fromString(saved.secretKey),
          signingKey: Buffer.from(saved.signingKey, 'hex'),
          salt: Fr.fromString(saved.salt),
        };
        const account = await connectWithCredentials(credentials, wallet, set);
        return account;
      }

      set({ status: 'disconnected', pxeStatus: 'idle', pxeError: null });
      return null;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to connect existing account';
      set({
        status: 'disconnected',
        error: message,
        pxeStatus: 'error',
        pxeError: message,
      });
      return null;
    }
  },

  hasSavedEmbeddedAccount: (): boolean => {
    if (hasConfiguredCredentials()) {
      return true;
    }
    return getSavedAccount() !== null;
  },
});

export { clearSavedAccount };
