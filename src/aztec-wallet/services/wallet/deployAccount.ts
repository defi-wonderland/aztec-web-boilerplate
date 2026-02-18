import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AccountManager } from '@aztec/aztec.js/wallet';
import { TxStatus } from '@aztec/stdlib/tx';
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
  skipClassPublication: false,
  skipInstancePublication: false,
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
    console.log('[deploy-account] Checking contract metadata...');
    const metadata =
      await pxeInstance.wallet.getContractMetadata(accountAddress);
    console.log(
      '[deploy-account] Contract initialized:',
      metadata.isContractInitialized
    );

    if (metadata.isContractInitialized) {
      return { deployed: false, address: accountAddress };
    }

    console.log('[deploy-account] Getting deploy method...');
    const deployMethod = await accountManager.getDeployMethod();
    console.log('[deploy-account] Getting sponsored fee payment method...');
    const paymentMethod = await pxeInstance.getSponsoredFeePaymentMethod();
    console.log('[deploy-account] Sending deploy tx...');

    await deployMethod.send({
      from: AztecAddress.ZERO,
      fee: { paymentMethod },
      skipClassPublication: opts.skipClassPublication,
      skipInstancePublication: opts.skipInstancePublication,
      wait: { timeout: opts.timeout, waitForStatus: TxStatus.PROPOSED },
    });

    console.log('[deploy-account] Deploy tx confirmed');
    return { deployed: true, address: accountAddress };
  } catch (cause) {
    console.error(
      '[deploy-account] Deployment failed:',
      cause instanceof Error ? cause.message : cause
    );
    throw new AccountDeploymentError(
      `Failed to deploy account at ${accountAddress.toString()}`,
      cause
    );
  }
}
