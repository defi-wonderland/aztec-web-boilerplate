/**
 * Core write execution for app-managed wallets.
 *
 * Pure async functions — no React dependency.
 */

import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { AztecAddress as AztecAddressType } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { TxStatus } from '@aztec/stdlib/tx';
import { getContractMethod } from './utils/getContractMethod';
import type { WriteContractData } from '../../use-aztec/types/contractTypes';

// =============================================================================
// App-Managed Write
// =============================================================================

export interface AppManagedWriteParams {
  wallet: Wallet;
  fromAddress: AztecAddressType;
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: unknown[];
  createFeePaymentMethod: (
    feePaymentMethod?: unknown
  ) => Promise<FeePaymentMethod | undefined>;
  feePaymentMethod?: unknown;
  timeout?: number;
}

/**
 * Executes a contract write via app-managed PXE wallet.
 */
export const executeAppManagedWrite = async (
  params: AppManagedWriteParams
): Promise<WriteContractData> => {
  const {
    wallet,
    fromAddress,
    artifact,
    address,
    functionName,
    args,
    createFeePaymentMethod,
    feePaymentMethod,
    timeout,
  } = params;

  const paymentMethod = await createFeePaymentMethod(feePaymentMethod);

  const contractAddress = AztecAddress.fromString(address);
  const contractInstance = Contract.at(contractAddress, artifact, wallet);

  const method = getContractMethod(contractInstance, functionName);
  if (!method) {
    throw new Error(`Method ${functionName} not found on contract`);
  }

  const tx = method(...args);

  // Simulate with gas estimation to get proper gas settings
  let estimatedGas;
  try {
    const simResult = await tx.simulate({
      from: fromAddress,
      ...(paymentMethod ? { fee: { paymentMethod, estimateGas: true } } : {}),
    });
    estimatedGas = simResult.estimatedGas;
  } catch (simErr) {
    const simErrorMsg =
      simErr instanceof Error ? simErr.message : 'Simulation failed';
    throw new Error(`Simulation failed: ${simErrorMsg}`);
  }

  const result = await tx.send({
    from: fromAddress,
    ...(paymentMethod
      ? {
          fee: {
            paymentMethod,
            ...(estimatedGas ? { gasSettings: estimatedGas } : {}),
          },
        }
      : {}),
    wait: { timeout: timeout ?? 900, waitForStatus: TxStatus.PROPOSED },
  });

  return { result };
};
