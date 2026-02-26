import { useMutation } from '@tanstack/react-query';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import { useAztec } from '../context/useAztec';
import type {
  MethodsOf,
  WriteContractData,
  WriteContractMutateParams,
  UseWriteContractOptions,
  UseWriteContractReturn,
} from '../../types/contractTypes';

const DEFAULT_FEE_PAYMENT_METHOD = 'sponsored' as const;

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
  const { executeWrite } = useAztec();

  const mutation = useMutation<
    WriteContractData,
    Error,
    WriteContractMutateParams<ContractBase, string>
  >({
    mutationFn: async (params) => {
      return executeWrite({
        artifact: params.contract.artifact,
        address: params.address,
        functionName: String(params.functionName),
        args: params.args as unknown[],
        feePaymentMethod: params.feePaymentMethod ?? DEFAULT_FEE_PAYMENT_METHOD,
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
