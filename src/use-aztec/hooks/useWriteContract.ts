import { useMutation } from '@tanstack/react-query';
import { writeContract as writeContractAction } from '../actions/writeContract';
import { useInternalAztecClient } from '../context/useInternalAztecClient';
import { AztecClientNotReady } from '../errors';
import type {
  WriteContractActionParams,
  WriteContractData,
  UseWriteContractOptions,
  UseWriteContractReturn,
} from '../types/contractTypes';

/**
 * Write hook wrapping `useMutation`.
 * Returns a standard TanStack mutation — call `.mutate()` / `.mutateAsync()`.
 *
 * @example
 * ```tsx
 * const write = useWriteContract({
 *   mutation: { onSuccess: (data) => console.log('tx:', data.txHash) }
 * });
 *
 * write.mutate(
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

  return useMutation<WriteContractData, Error, WriteContractActionParams>({
    mutationFn: async (params) => {
      if (!client) {
        throw new AztecClientNotReady();
      }
      return writeContractAction(client, params);
    },
    onSuccess,
    onError,
    onSettled,
  }) as unknown as UseWriteContractReturn;
};
