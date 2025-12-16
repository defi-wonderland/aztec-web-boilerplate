/**
 * useEmbeddedWallet - Hook for Embedded wallet management
 *
 * Manages wallets with app-managed PXE and internal signing.
 * Uses SharedPXEService for PXE connection.
 */

import { useState, useCallback, useEffect } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { getInitialTestAccountsData } from '@aztec/accounts/testing/lazy';
import { poseidon2Hash, randomBytes } from '@aztec/foundation/crypto';
import { useSharedPXE, type UseSharedPXEReturn } from './useSharedPXE';
import { useError } from '../ErrorProvider';
import { isValidConfig } from '../../utils';
import { getConfiguredAccountCredentials, hasConfiguredCredentials } from '../../utils/accountCredentials';
import type { NetworkConfig } from '../../config/networks';
import type { AccountCredentials } from '../../types/aztec';
import type { MinimalWallet } from '../../utils/MinimalWallet';

export interface EmbeddedWalletState {
  embeddedAccount: AccountWithSecretKey | null;
  isDeploying: boolean;
  isInitialized: boolean;
}

export interface EmbeddedWalletActions {
  create: () => Promise<AccountWithSecretKey>;
  connectTest: (index: number) => Promise<AccountWithSecretKey>;
  connectExisting: () => Promise<AccountWithSecretKey | null>;
  disconnect: () => void;
  reinitialize: () => Promise<void>;
  hasSavedAccount: () => boolean;
}

export interface EmbeddedWalletServices {
  pxe: PXE | null;
  wallet: MinimalWallet | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface UseEmbeddedWalletReturn {
  state: EmbeddedWalletState;
  actions: EmbeddedWalletActions;
  services: EmbeddedWalletServices;
  sharedPXE: UseSharedPXEReturn;
  isLoading: boolean;
  error: string | null;
}

interface UseEmbeddedWalletOptions {
  config: NetworkConfig;
  resetToDefault: () => void;
}

const STORAGE_KEY = 'aztec-embedded-account';

interface StoredAccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

/**
 * Hook for managing Embedded wallets (internal signing).
 * Uses shared PXE with auto-initialization.
 */
export const useEmbeddedWallet = (
  options: UseEmbeddedWalletOptions
): UseEmbeddedWalletReturn => {
  const { config, resetToDefault } = options;

  // Use shared PXE with auto-initialization
  const sharedPXE = useSharedPXE({ config, autoInitialize: true });

  // Local state
  const [embeddedAccount, setEmbeddedAccount] = useState<AccountWithSecretKey | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addMessage } = useError();

  // Validate config on mount
  useEffect(() => {
    if (!isValidConfig(config)) {
      console.warn(`⚠️ Invalid config for ${config.name}, falling back to default`);
      resetToDefault();
    }
  }, [config, resetToDefault]);

  // Auto-reconnect when PXE is initialized
  useEffect(() => {
    if (!sharedPXE.state.isInitialized || embeddedAccount) return;

    const savedAccount = getSavedAccount();
    if (savedAccount) {
      console.log('🔄 Found saved account, auto-reconnecting...');
      reconnectExisting(savedAccount).catch((err) => {
        console.warn('⚠️ Failed to auto-reconnect:', err);
        clearSavedAccount();
      });
    }
  }, [sharedPXE.state.isInitialized]);

  const connectWithCredentials = async (
    credentials: AccountCredentials,
    wallet: MinimalWallet
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
    const artifact = await accountManager.getAccountContract().getContractArtifact();
    await wallet.registerContract(instance, artifact, accountManager.getSecretKey());
    wallet.addAccount(account);

    setEmbeddedAccount(account);
    console.log('✅ Connected to account:', account.getAddress().toString());

    return account;
  };

  const reconnectExisting = async (saved: StoredAccountData, wallet?: MinimalWallet): Promise<AccountWithSecretKey> => {
    const walletInstance = wallet ?? sharedPXE.services.wallet;
    if (!walletInstance) {
      throw new Error('Wallet not initialized');
    }

    const credentials: AccountCredentials = {
      secretKey: Fr.fromString(saved.secretKey),
      signingKey: Buffer.from(saved.signingKey, 'hex'),
      salt: Fr.fromString(saved.salt),
    };

    return connectWithCredentials(credentials, walletInstance);
  };

  const create = useCallback(async (): Promise<AccountWithSecretKey> => {
    setIsLoading(true);
    setError(null);

    try {
      // Ensure PXE is initialized
      const pxeInstance = await sharedPXE.actions.initialize();
      const wallet = pxeInstance.wallet;

      // Generate new credentials
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
      const artifact = await accountManager.getAccountContract().getContractArtifact();
      await wallet.registerContract(instance, artifact, accountManager.getSecretKey());
      wallet.addAccount(account);

      console.log('✅ New embedded account created:', accountManager.address.toString());

      // Deploy account
      setIsDeploying(true);
      try {
        const metadata = await wallet.getContractMetadata(accountManager.address);
        if (!metadata.isContractInitialized) {
          console.log('🚀 Deploying account contract...');
          const deployMethod = await accountManager.getDeployMethod();
          const paymentMethod = await pxeInstance.getSponsoredFeePaymentMethod();

          await deployMethod
            .send({
              from: AztecAddress.ZERO,
              fee: { paymentMethod },
              skipClassPublication: true,
              skipInstancePublication: true,
            })
            .wait({ timeout: 120 });

          console.log('✅ Account deployed successfully');
        }
      } catch (deployErr) {
        console.error('❌ Account deployment failed:', deployErr);
        addMessage({
          message: 'Account deployment failed',
          type: 'warning',
          source: 'wallet',
          details: deployErr instanceof Error ? deployErr.message : String(deployErr),
        });
      } finally {
        setIsDeploying(false);
      }

      // Save account credentials
      saveAccount({
        address: accountManager.address.toString(),
        signingKey: signingKey.toString('hex'),
        secretKey: secretKey.toString(),
        salt: salt.toString(),
      });

      setEmbeddedAccount(account);
      return account;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sharedPXE, addMessage]);

  const connectTest = useCallback(async (index: number): Promise<AccountWithSecretKey> => {
    setIsLoading(true);
    setError(null);

    try {
      const pxeInstance = await sharedPXE.actions.initialize();
      const wallet = pxeInstance.wallet;

      const testAccounts = await getInitialTestAccountsData();
      const testAccount = testAccounts[index];

      const accountContract = new SchnorrAccountContract(testAccount.signingKey);
      const accountManager = await AccountManager.create(
        wallet,
        testAccount.secret,
        accountContract,
        testAccount.salt
      );

      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager.getAccountContract().getContractArtifact();
      await wallet.registerContract(instance, artifact, accountManager.getSecretKey());
      wallet.addAccount(account);

      console.log('✅ Test account connected:', account.getAddress().toString());
      setEmbeddedAccount(account);

      return account;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect test account';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sharedPXE]);

  const connectExisting = useCallback(async (): Promise<AccountWithSecretKey | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Ensure PXE is initialized
      const pxeInstance = await sharedPXE.actions.initialize();
      const wallet = pxeInstance.wallet;

      const envCredentials = await getConfiguredAccountCredentials();
      if (envCredentials) {
        console.log('🔑 Connecting with configured credentials from env...');
        const account = await connectWithCredentials(envCredentials, wallet);
        return account;
      }

      const saved = getSavedAccount();
      if (saved) {
        console.log('🔄 Connecting with saved credentials from localStorage...');
        const account = await reconnectExisting(saved, wallet);
        return account;
      }

      console.warn('No configured or saved account found');
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect existing account';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sharedPXE]);

  const disconnect = useCallback(() => {
    setEmbeddedAccount(null);
    setIsDeploying(false);
    clearSavedAccount();
  }, []);

  const reinitialize = useCallback(async (): Promise<void> => {
    sharedPXE.actions.reset();
    setEmbeddedAccount(null);
    await sharedPXE.actions.initialize();
  }, [sharedPXE]);

  const hasSavedAccount = useCallback((): boolean => {
    if (hasConfiguredCredentials()) {
      return true;
    }
    return getSavedAccount() !== null;
  }, []);

  return {
    state: {
      embeddedAccount,
      isDeploying,
      isInitialized: sharedPXE.state.isInitialized,
    },
    actions: {
      create,
      connectTest,
      connectExisting,
      disconnect,
      reinitialize,
      hasSavedAccount,
    },
    services: {
      pxe: sharedPXE.services.pxe,
      wallet: sharedPXE.services.wallet,
      getSponsoredFeePaymentMethod: sharedPXE.services.getSponsoredFeePaymentMethod,
    },
    sharedPXE,
    isLoading: isLoading || sharedPXE.state.isInitializing,
    error: error || sharedPXE.state.error,
  };
};

// Storage helpers
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
  } catch (err) {
    console.error('Failed to save account:', err);
  }
};

const clearSavedAccount = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
};
