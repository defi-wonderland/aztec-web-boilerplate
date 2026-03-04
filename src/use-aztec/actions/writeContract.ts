import type {
  WriteContractActionParams,
  WriteContractData,
} from '../types/contractTypes';
import type { AztecExecutionClient } from '../types/execution';

export type { WriteContractActionParams };

/**
 * Pure async action for executing a write operation on an Aztec contract.
 *
 * @param client - The execution client (provided by the calling hook via context).
 * @param params - Contract write parameters.
 *
 * @example
 * ```ts
 * const result = await writeContract(client, {
 *   contract: DripperContract,
 *   address: dripperAddress,
 *   functionName: 'drip_to_private',
 *   args: [tokenAddress, amount],
 * });
 * ```
 */
export const writeContract = async (
  client: AztecExecutionClient,
  params: WriteContractActionParams
): Promise<WriteContractData> => {
  return client.executeWrite({
    artifact: params.contract.artifact,
    address: params.address,
    functionName: params.functionName,
    args: params.args,
    feePaymentMethod: params.feePaymentMethod,
    timeout: params.timeout,
    receiptPolling: params.receiptPolling,
  });
};
