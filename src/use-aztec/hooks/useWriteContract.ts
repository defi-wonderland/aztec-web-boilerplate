import { useMutation } from '@tanstack/react-query';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import {
  writeContract as writeContractAction,
  type WriteContractActionParams,
} from '../actions/writeContract';
import { useInternalAztecClient } from '../context/useInternalAztecClient';
import { AztecClientNotReadyError } from '../errors';
import type {
  MethodsOf,
  WriteContractData,
  WriteContractMutateParams,
  WriteContractCallOptions,
  UseWriteContractOptions,
  UseWriteContractReturn,
} from '../../types/contractTypes';

/**
 * Hook for executing write operations on Aztec contracts.
 * Wraps React Query's `useMutation` to provide wagmi-like ergonomics.
 *
 * Supports both hook-level callbacks (via `mutation` option) and
 * per-call callbacks (second argument to writeContract/writeContractAsync),
 * matching wagmi v2's API.
 *
 * @example
 * ```tsx
 * // Hook-level callbacks
 * const { writeContract } = useWriteContract({
 *   mutation: { onSuccess: (data) => console.log('tx:', data.txHash) }
 * });
 *
 * // Per-call callbacks (override hook-level)
 * writeContract(
 *   { contract: DripperContract, address, functionName: 'drip_to_private', args },
 *   { onSuccess: (data) => invalidateQueries() }
 * );
 * ```
 */
export const useWriteContract = (
  options: UseWriteContractOptions = {}
): UseWriteContractReturn => {
  const { onSuccess, onError, onSettled } = options.mutation ?? {};
  const client = useInternalAztecClient();

  const mutation = useMutation<
    WriteContractData,
    Error,
    WriteContractActionParams
  >({
    mutationFn: async (params) => {
      if (!client) {
        throw new AztecClientNotReadyError();
      }
      return writeContractAction(client, params);
    },
    onSuccess,
    onError,
    onSettled,
  });

  const toWriteActionParams = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>
  ): WriteContractActionParams => {
    return {
      contract: params.contract,
      address: params.address,
      functionName: String(params.functionName),
      args: params.args,
      feePaymentMethod: params.feePaymentMethod,
      timeout: params.timeout,
      receiptPolling: params.receiptPolling,
    };
  };

  const writeContract = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>,
    callOptions?: WriteContractCallOptions
  ): void => {
    mutation.mutate(toWriteActionParams(params), callOptions);
  };

  const writeContractAsync = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>,
    callOptions?: WriteContractCallOptions
  ): Promise<WriteContractData> => {
    return mutation.mutateAsync(toWriteActionParams(params), callOptions);
  };

  return {
    writeContract,
    writeContractAsync,
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    isIdle: mutation.isIdle,
    status: mutation.status,
    reset: mutation.reset,
  };
};
