import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { randomBytes } from '@aztec/foundation/crypto/random';
import {
  getConfiguredAccountCredentials,
  hasConfiguredCredentials,
} from '../../../utils/accountCredentials';
import { SharedPXEService, type SharedPXEInstance } from '../aztec/pxe';
import {
  deployAccountIfNotExists,
  type DeployAccountResult,
} from './deployAccount';
import {
  AccountCreationError,
  AccountLoadError,
  NoSavedAccountError,
  PXEInitError,
} from './errors';
import type { NetworkConfig } from '../../../config/networks/types';
import type { AccountCredentials } from '../../types/aztec';

// ============================================================================
// Types
// ============================================================================

export interface CreateEmbeddedAccountResult {
  account: AccountWithSecretKey;
  pxeInstance: SharedPXEInstance;
  deployment: DeployAccountResult;
  credentials: StoredAccountData;
}

export interface LoadEmbeddedAccountResult {
  account: AccountWithSecretKey;
  pxeInstance: SharedPXEInstance;
}

export interface StoredAccountData {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

// ============================================================================
// Storage helpers
// ============================================================================

const STORAGE_KEY = 'aztec-embedded-account';

export const getSavedAccount = (): StoredAccountData | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveAccount = (data: StoredAccountData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
};

export const clearSavedAccount = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
};

export const hasSavedEmbeddedAccount = (): boolean => {
  if (hasConfiguredCredentials()) {
    return true;
  }
  return getSavedAccount() !== null;
};

// ============================================================================
// Account creation service
// ============================================================================

/**
 * Create a new embedded wallet account.
 * Generates fresh credentials, registers the account with PXE, and deploys if needed.
 *
 * @param networkConfig - Network configuration with node URL
 * @returns Created account, PXE instance, deployment status, and credentials
 * @throws PXEInitError if PXE initialization fails
 * @throws AccountCreationError if account creation fails
 */
export async function createEmbeddedAccount(
  networkConfig: NetworkConfig
): Promise<CreateEmbeddedAccountResult> {
  let pxeInstance: SharedPXEInstance;

  console.log('[embedded-account] Starting account creation...');

  try {
    console.log('[embedded-account] Initializing PXE...');
    pxeInstance = await SharedPXEService.getInstance(
      networkConfig.nodeUrl,
      networkConfig.name
    );
    console.log('[embedded-account] PXE initialized');
  } catch (cause) {
    console.error('[embedded-account] PXE init failed:', cause);
    throw new PXEInitError(
      `Failed to initialize PXE for network ${networkConfig.name}`,
      cause
    );
  }

  try {
    const wallet = pxeInstance.wallet;

    // Generate fresh credentials
    console.log('[embedded-account] Generating credentials...');
    const salt = Fr.fromBuffer(randomBytes(32));
    const secretKey = await poseidon2Hash([Fr.fromBuffer(randomBytes(32))]);
    const signingKey = Buffer.from(secretKey.toBuffer().subarray(0, 32));
    console.log('[embedded-account] Credentials generated');

    // Create account manager
    console.log('[embedded-account] Creating AccountManager...');
    const accountContract = new EcdsaRAccountContract(signingKey);
    const accountManager = await AccountManager.create(
      wallet,
      secretKey,
      accountContract,
      salt
    );
    console.log(
      '[embedded-account] AccountManager created, address:',
      accountManager.address.toString()
    );

    // Get account and register with PXE
    console.log('[embedded-account] Getting account...');
    const account = await accountManager.getAccount();
    console.log('[embedded-account] Getting instance and artifact...');
    const instance = accountManager.getInstance();
    const artifact = await accountManager
      .getAccountContract()
      .getContractArtifact();
    console.log('[embedded-account] Registering contract with PXE...');
    await wallet.registerContract(
      instance,
      artifact,
      accountManager.getSecretKey()
    );
    wallet.addAccount(account);
    console.log('[embedded-account] Account registered with PXE');

    // Deploy if needed (don't throw on deployment failure)
    // Use a hard timeout because send() simulation can hang indefinitely
    // and the SDK's wait.timeout only applies after the tx is actually sent.
    const DEPLOY_HARD_TIMEOUT_MS = 90_000;
    let deployment: DeployAccountResult;
    try {
      console.log('[embedded-account] Starting account deployment...');
      deployment = await Promise.race([
        deployAccountIfNotExists(accountManager, pxeInstance),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Account deployment timed out')),
            DEPLOY_HARD_TIMEOUT_MS
          )
        ),
      ]);
      console.log(
        '[embedded-account] Deployment result:',
        deployment.deployed ? 'deployed' : 'already initialized'
      );
    } catch (err) {
      console.warn(
        '[embedded-account] Deployment failed or timed out, continuing without deployment:',
        err instanceof Error ? err.message : err
      );
      deployment = { deployed: false, address: accountManager.address };
    }

    // Prepare credentials for storage
    const credentials: StoredAccountData = {
      address: accountManager.address.toString(),
      signingKey: signingKey.toString('hex'),
      secretKey: secretKey.toString(),
      salt: salt.toString(),
    };

    console.log('[embedded-account] Account creation complete');
    return { account, pxeInstance, deployment, credentials };
  } catch (cause) {
    console.error(
      '[embedded-account] Account creation failed:',
      cause instanceof Error ? cause.message : cause
    );
    if (cause instanceof PXEInitError) throw cause;
    throw new AccountCreationError('Failed to create embedded account', cause);
  }
}

// ============================================================================
// Account loading service
// ============================================================================

/**
 * Load an existing embedded account from saved credentials or environment config.
 *
 * @param networkConfig - Network configuration with node URL
 * @returns Loaded account and PXE instance
 * @throws PXEInitError if PXE initialization fails
 * @throws NoSavedAccountError if no saved account exists
 * @throws AccountLoadError if loading fails
 */
export async function loadExistingEmbeddedAccount(
  networkConfig: NetworkConfig
): Promise<LoadEmbeddedAccountResult> {
  let pxeInstance: SharedPXEInstance;

  try {
    pxeInstance = await SharedPXEService.getInstance(
      networkConfig.nodeUrl,
      networkConfig.name
    );
  } catch (cause) {
    throw new PXEInitError(
      `Failed to initialize PXE for network ${networkConfig.name}`,
      cause
    );
  }

  // Try environment credentials first
  const envCredentials = await getConfiguredAccountCredentials();
  if (envCredentials) {
    try {
      const account = await connectWithCredentials(envCredentials, pxeInstance);
      return { account, pxeInstance };
    } catch (cause) {
      throw new AccountLoadError(
        'Failed to load account from environment credentials',
        cause
      );
    }
  }

  // Try saved credentials
  const saved = getSavedAccount();
  if (saved) {
    try {
      const credentials: AccountCredentials = {
        secretKey: Fr.fromString(saved.secretKey),
        signingKey: Buffer.from(saved.signingKey, 'hex'),
        salt: Fr.fromString(saved.salt),
      };
      const account = await connectWithCredentials(credentials, pxeInstance);
      return { account, pxeInstance };
    } catch (cause) {
      throw new AccountLoadError(
        'Failed to load account from saved credentials',
        cause
      );
    }
  }

  throw new NoSavedAccountError();
}

// ============================================================================
// Internal helpers
// ============================================================================

async function connectWithCredentials(
  credentials: AccountCredentials,
  pxeInstance: SharedPXEInstance
): Promise<AccountWithSecretKey> {
  const wallet = pxeInstance.wallet;
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

  // Deploy account if not yet initialized (e.g., sandbox was restarted)
  // Hard timeout to prevent simulation from hanging indefinitely
  const DEPLOY_HARD_TIMEOUT_MS = 90_000;
  try {
    await Promise.race([
      deployAccountIfNotExists(accountManager, pxeInstance),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Account deployment timed out')),
          DEPLOY_HARD_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err) {
    console.warn(
      '[embedded-account] Deployment failed or timed out:',
      err instanceof Error ? err.message : err
    );
    // Non-fatal: account may still work if already deployed
  }

  return account;
}
