import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { EcdsaKEthSignerAccountContract } from '../../signers/EcdsaKEthSignerAccountContract';
import { SharedPXEService, type SharedPXEInstance } from '../aztec/pxe';
import {
  deployAccountIfNotExists,
  type DeployAccountResult,
} from './deployAccount';
import {
  AccountCreationError,
  PXEInitError,
  SignerConnectionError,
} from './errors';
import type { NetworkConfig } from '../../../config/networks/types';
import type { ExternalSigner } from '../../signers/types';
import type { ExternalSignerType } from '../../types/aztec';

// ============================================================================
// Types
// ============================================================================

export interface CreateExternalSignerAccountResult {
  account: AccountWithSecretKey;
  pxeInstance: SharedPXEInstance;
  deployment: DeployAccountResult;
  signerType: ExternalSignerType;
  rdns: string | null;
}

// ============================================================================
// Account creation service
// ============================================================================

/**
 * Create an account using an external signer (e.g., MetaMask).
 * Connects to the signer, derives keys, and deploys the account if needed.
 *
 * @param signer - External signer instance
 * @param networkConfig - Network configuration with node URL
 * @returns Created account, PXE instance, deployment status, and signer info
 * @throws SignerConnectionError if signer connection fails
 * @throws PXEInitError if PXE initialization fails
 * @throws AccountCreationError if account creation fails
 */
export async function createExternalSignerAccount(
  signer: ExternalSigner,
  networkConfig: NetworkConfig
): Promise<CreateExternalSignerAccountResult> {
  // Connect signer if not connected
  if (!signer.isConnected()) {
    try {
      await signer.connect();
    } catch (cause) {
      throw new SignerConnectionError(
        `Failed to connect to ${signer.label} signer`,
        cause
      );
    }
  }

  // Initialize PXE
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

  try {
    // Get public key from signer
    const { x, y } = await signer.getPublicKey();

    // Create auth witness provider for transaction signing
    const authWitnessProvider = signer.createAuthWitnessProvider(
      {} as Parameters<typeof signer.createAuthWitnessProvider>[0]
    );

    // Create account contract with signer's public key
    const accountContract = new EcdsaKEthSignerAccountContract(
      x,
      y,
      authWitnessProvider
    );

    // Derive secret key and salt from signer
    const secretKeyBuffer = await signer.deriveSecretKey();
    const secretKey = await poseidon2Hash([Fr.fromBuffer(secretKeyBuffer)]);
    const salt = Fr.fromBuffer(signer.deriveSalt());

    // Create account manager
    const wallet = pxeInstance.wallet;
    const accountManager = await AccountManager.create(
      wallet,
      secretKey,
      accountContract,
      salt
    );

    // Get account and register with PXE
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

    // Deploy if needed (don't throw on deployment failure)
    let deployment: DeployAccountResult;
    try {
      deployment = await deployAccountIfNotExists(accountManager, pxeInstance);
    } catch {
      // Account created but deployment failed - still usable
      deployment = { deployed: false, address: accountManager.address };
    }

    return {
      account,
      pxeInstance,
      deployment,
      signerType: signer.type,
      rdns: signer.rdns ?? null,
    };
  } catch (cause) {
    if (
      cause instanceof PXEInitError ||
      cause instanceof SignerConnectionError
    ) {
      throw cause;
    }
    throw new AccountCreationError(
      `Failed to create account with ${signer.label} signer`,
      cause
    );
  }
}
