import { useQuery } from '@tanstack/react-query';
import { readContracts as readContractsAction } from '../actions/readContracts';
import { useInternalAztecClient } from '../context/useInternalAztecClient';
import { AztecClientNotReady } from '../errors';
import { normalizeQueryKeyValue, normalizeScopeKey } from '../utils/queryKey';
import type {
  ReadContractResult,
  UseReadContractsParams,
} from '../../types/contractTypes';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * Declarative hook for batching multiple Aztec contract reads into a single query.
 *
 * Mirrors wagmi's `useReadContracts` API: pass an array of contract read configs
 * and the hook batches them into a single `useQuery`, providing one cache entry,
 * one loading state, and atomic refetches.
 *
 * Returns the full TanStack `UseQueryResult` object.
 *
 * @example
 * ```tsx
 * const result = useReadContracts({
 *   scopeKey: ['tokenBalance', tokenAddress, ownerAddress],
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
): UseQueryResult<TSelectData, Error> => {
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

  const client = useInternalAztecClient();
  const isEnabled = Boolean(
    (queryEnabled ?? true) && client && params.contracts.length > 0
  );

  const scopePrefix = normalizeScopeKey(params.scopeKey);
  const queryKey = [
    ...scopePrefix,
    'readContracts',
    { allowFailure },
    params.contracts.map((c) => [
      c.address,
      String(c.functionName),
      normalizeQueryKeyValue(c.args),
    ]),
  ];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!client) {
        throw new AztecClientNotReady();
      }
      return readContractsAction(client, {
        contracts: params.contracts,
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
};
