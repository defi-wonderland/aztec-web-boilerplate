/**
 * Core read execution for app-managed PXE wallets.
 *
 * Pure async function — no React dependency.
 */

import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecAddress as AztecAddressType } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { getContractMethod } from '../utils/getContractMethod';
import type { SimulateViewsOp } from '../../types/browserWallet';
import type {
  BrowserWalletOperation,
  BrowserWalletOperationResult,
} from '../../types/browserWallet';

export interface AppManagedReadParams {
  wallet: Wallet;
  fromAddress: AztecAddressType;
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: unknown[];
}

/**
 * Executes a contract read via an app-managed PXE wallet.
 */
export const executeAppManagedRead = async (
  params: AppManagedReadParams
): Promise<unknown> => {
  const { wallet, fromAddress, artifact, address, functionName, args } = params;

  const contractAddress = AztecAddress.fromString(address);
  const contractInstance = Contract.at(contractAddress, artifact, wallet);

  const method = getContractMethod(contractInstance, functionName);
  if (!method) {
    throw new Error(`Method ${functionName} not found on contract`);
  }

  return method(...args).simulate({ from: fromAddress });
};

export interface BrowserWalletReadParams {
  executeOperation: (
    operation: BrowserWalletOperation
  ) => Promise<BrowserWalletOperationResult>;
  getCaipAccount: () => string | null;
  address: string;
  functionName: string;
  args: unknown[];
}

/**
 * Executes a contract read via browser wallet simulation.
 */
export const executeBrowserWalletRead = async (
  params: BrowserWalletReadParams
): Promise<unknown> => {
  const { executeOperation, getCaipAccount, address, functionName, args } =
    params;

  const selectedAccount = getCaipAccount();
  if (!selectedAccount) {
    throw new Error('Browser wallet account not selected');
  }

  const operation: SimulateViewsOp = {
    kind: 'simulate_views',
    account: selectedAccount,
    calls: [
      {
        kind: 'call',
        contract: address,
        method: functionName,
        args,
      },
    ],
  };

  const result = await executeOperation(operation);

  if (result.status !== 'ok') {
    const errorMsg =
      'error' in result && result.error ? result.error : 'Simulation failed';
    throw new Error(errorMsg);
  }

  return result.result;
};
