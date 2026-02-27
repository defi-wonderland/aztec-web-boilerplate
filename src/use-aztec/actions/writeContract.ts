import type { ContractBase } from '@aztec/aztec.js/contracts';
import { getClient } from '../config/clientStore';
import type {
  MethodsOf,
  WriteContractData,
  WriteContractMutateParams,
} from '../../types/contractTypes';

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
export const writeContract = async <
  T extends ContractBase,
  M extends MethodsOf<T>,
>(
  params: WriteContractMutateParams<T, M>
): Promise<WriteContractData> => {
  const client = getClient();

  return client.executeWrite({
    artifact: params.contract.artifact,
    address: params.address,
    functionName: String(params.functionName),
    args: params.args as unknown[],
    feePaymentMethod: params.feePaymentMethod,
    timeout: params.timeout,
    receiptPolling: params.receiptPolling,
  });
};
