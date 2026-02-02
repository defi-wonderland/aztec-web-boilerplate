import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AccountManager } from '@aztec/aztec.js/wallet';
import { AccountDeploymentError } from './errors';
import type { SharedPXEInstance } from '../aztec/pxe';

export interface DeployAccountOptions {
  /** Timeout in seconds for deployment transaction */
  timeout?: number;
  /** Skip class publication during deployment */
  skipClassPublication?: boolean;
  /** Skip instance publication during deployment */
  skipInstancePublication?: boolean;
}

export interface DeployAccountResult {
  /** Whether the account was deployed (false if already initialized) */
  deployed: boolean;
  /** Account address */
  address: AztecAddress;
}

const DEFAULT_OPTIONS: Required<DeployAccountOptions> = {
  timeout: 120,
  skipClassPublication: true,
  skipInstancePublication: true,
};

/**
 * Deploy an account contract if not already initialized.
 * Uses sponsored fee payment method for gas-free deployment.
 *
 * @param accountManager - The AccountManager instance
 * @param pxeInstance - SharedPXE instance with wallet and fee methods
 * @param options - Deployment options
 * @returns Deployment result with status and address
 * @throws AccountDeploymentError if deployment fails
 */
export async function deployAccountIfNotExists(
  accountManager: AccountManager,
  pxeInstance: SharedPXEInstance,
  options: DeployAccountOptions = {}
): Promise<DeployAccountResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const accountAddress = accountManager.address;

  try {
    const metadata =
      await pxeInstance.wallet.getContractMetadata(accountAddress);

    if (metadata.isContractInitialized) {
      return { deployed: false, address: accountAddress };
    }

    const deployMethod = await accountManager.getDeployMethod();
    const paymentMethod = await pxeInstance.getSponsoredFeePaymentMethod();

    await deployMethod
      .send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        skipClassPublication: opts.skipClassPublication,
        skipInstancePublication: opts.skipInstancePublication,
      })
      .wait({ timeout: opts.timeout });

    return { deployed: true, address: accountAddress };
  } catch (cause) {
    throw new AccountDeploymentError(
      `Failed to deploy account at ${accountAddress.toString()}`,
      cause
    );
  }
}
