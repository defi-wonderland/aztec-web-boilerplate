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
