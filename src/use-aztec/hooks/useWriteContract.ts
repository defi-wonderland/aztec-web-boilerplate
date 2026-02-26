import { useMutation } from '@tanstack/react-query';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import { useInternalAztecClient } from '../context/useInternalAztecClient';
import { AztecClientNotReadyError } from '../runtime/errors';
import type {
  MethodsOf,
  WriteContractData,
  WriteContractMutateParams,
  UseWriteContractOptions,
  UseWriteContractReturn,
} from '../../types/contractTypes';

/**
 * Hook for executing write operations on Aztec contracts.
 * Wraps React Query's `useMutation` to provide wagmi-like ergonomics.
 *
 * @example
 * ```tsx
 * const { writeContract, writeContractAsync, isPending } = useWriteContract();
 *
 * writeContract({
 *   contract: DripperContract,
 *   address: dripperAddress,
 *   functionName: 'drip_to_private',
 *   args: [tokenAddress, amount],
 * });
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
    WriteContractMutateParams<ContractBase, string>
  >({
    mutationFn: async (params) => {
      if (!client) {
        throw new AztecClientNotReadyError();
      }

      return client.executeWrite({
        artifact: params.contract.artifact,
        address: params.address,
        functionName: String(params.functionName),
        args: params.args as unknown[],
        feePaymentMethod: params.feePaymentMethod,
        timeout: params.timeout,
        receiptPolling: params.receiptPolling,
      });
    },
    onSuccess,
    onError,
    onSettled,
  });

  const writeContract = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>
  ): void => {
    mutation.mutate(
      params as unknown as WriteContractMutateParams<ContractBase, string>
    );
  };

  const writeContractAsync = <T extends ContractBase, M extends MethodsOf<T>>(
    params: WriteContractMutateParams<T, M>
  ): Promise<WriteContractData> => {
    return mutation.mutateAsync(
      params as unknown as WriteContractMutateParams<ContractBase, string>
    );
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
