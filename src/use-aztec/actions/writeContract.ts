import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { getClient } from '../config/clientStore';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';
import type { WriteContractData } from '../../types/contractTypes';

export interface WriteContractActionParams {
  contract: { artifact: ContractArtifact };
  address: string;
  functionName: string;
  args: readonly unknown[];
  feePaymentMethod?: FeePaymentMethodType;
  timeout?: number;
  receiptPolling?: { intervalMs?: number; maxAttempts?: number };
}

/**
 * Pure async action for executing a write operation on an Aztec contract.
 *
 * Resolves the execution client from the module-level store (set by UseAztecProvider).
 * Throws `AztecClientNotReadyError` if the provider hasn't initialized yet.
 *
 * @example
 * ```ts
 * const result = await writeContract({
 *   contract: DripperContract,
 *   address: dripperAddress,
 *   functionName: 'drip_to_private',
 *   args: [tokenAddress, amount],
 * });
 * ```
 */
export const writeContract = async (
  params: WriteContractActionParams
): Promise<WriteContractData> => {
  const client = getClient();

  return client.executeWrite({
    artifact: params.contract.artifact,
    address: params.address,
    functionName: params.functionName,
    args: [...params.args],
    feePaymentMethod: params.feePaymentMethod,
    timeout: params.timeout,
    receiptPolling: params.receiptPolling,
  });
};
