import { useQuery } from '@tanstack/react-query';
import { useInternalAztecClient } from '../context/useInternalAztecClient';
import type {
  ReadContractResult,
  UseReadContractsParams,
  UseReadContractsReturn,
} from '../../types/contractTypes';

/**
 * Declarative hook for batching multiple Aztec contract reads into a single query.
 *
 * Mirrors wagmi's `useReadContracts` API: pass an array of contract read configs
 * and the hook batches them into a single `useQuery`, providing one cache entry,
 * one loading state, and atomic refetches.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useReadContracts({
 *   queryKey: ['tokenBalance', tokenAddress, ownerAddress],
 *   contracts: [
 *     { contract: TokenContract, address: tokenAddress, functionName: 'balance_of_private', args: [owner] },
 *     { contract: TokenContract, address: tokenAddress, functionName: 'balance_of_public', args: [owner] },
 *   ],
 *   allowFailure: false,
 * });
 * ```
 */
export const useReadContracts = <
  TAllowFailure extends boolean = true,
  TSelectData = TAllowFailure extends true ? ReadContractResult[] : unknown[],
>(
  params: UseReadContractsParams<TAllowFailure, TSelectData>
): UseReadContractsReturn<TSelectData> => {
  const client = useInternalAztecClient();
  const allowFailure = (params.allowFailure ?? true) as TAllowFailure;

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
    (queryEnabled ?? true) && client && params.contracts.length > 0
  );

  const queryKey = params.queryKey ?? [
    'readContracts',
    params.contracts.map((c) => [c.address, String(c.functionName), c.args]),
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!client) {
        throw new Error('Aztec execution client is not ready');
      }

      return client.executeBatchRead({
        contracts: params.contracts.map((c) => ({
          artifact: c.contract.artifact,
          address: c.address,
          functionName: String(c.functionName),
          args: c.args as unknown[],
        })),
        allowFailure: allowFailure as boolean,
      });
    },
    enabled: isEnabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    select: select as
      | ((data: ReadContractResult[] | unknown[]) => TSelectData)
      | undefined,
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
