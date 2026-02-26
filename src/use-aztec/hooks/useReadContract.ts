import { useQuery } from '@tanstack/react-query';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import { useAztec } from '../context/useAztec';
import type {
  MethodsOf,
  UseReadContractParams,
  UseReadContractReturn,
} from '../../types/contractTypes';

/**
 * Declarative hook for reading/simulating Aztec contract methods.
 *
 * Mirrors wagmi's `useReadContract` API: pass params declaratively and the
 * hook auto-fetches, caches, deduplicates, and refetches as needed.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useReadContract({
 *   queryKey: ['tokenBalance', tokenAddress, ownerAddress],
 *   contract: TokenContract,
 *   address: tokenAddress,
 *   functionName: 'balance_of_private',
 *   args: [ownerAddress],
 * });
 * ```
 */
export const useReadContract = <
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract>,
  TSelectData = unknown,
>(
  params: UseReadContractParams<TContract, TMethod, TSelectData>
): UseReadContractReturn<TSelectData> => {
  const { isConnected, account, executeRead } = useAztec();

  const {
    enabled: queryEnabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    select,
    retry,
  } = params.query ?? {};

  const isEnabled = Boolean(
    (queryEnabled ?? true) &&
      isConnected &&
      account &&
      params.address &&
      params.args !== undefined
  );

  const queryKey = params.queryKey ?? [
    'readContract',
    params.address,
    String(params.functionName),
    params.args,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!account || !params.address || params.args === undefined) {
        throw new Error('Missing required parameters');
      }

      return executeRead({
        artifact: params.contract.artifact,
        address: params.address,
        functionName: String(params.functionName),
        args: params.args as unknown[],
      });
    },
    enabled: isEnabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    select,
    retry,
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    isFetching: query.isFetching,
    status: query.status,
    refetch: async () => {
      await query.refetch();
    },
  };
};
