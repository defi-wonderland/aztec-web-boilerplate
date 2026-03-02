import { useQuery } from '@tanstack/react-query';
import type { ContractBase } from '@aztec/aztec.js/contracts';
import { readContract as readContractAction } from '../actions/readContract';
import { useInternalAztecClient } from '../context/useInternalAztecClient';
import { AztecClientNotReady } from '../errors';
import { normalizeQueryKeyValue, normalizeScopeKey } from '../utils/queryKey';
import type {
  MethodsOf,
  UseReadContractParams,
} from '../../types/contractTypes';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * Declarative hook for reading/simulating Aztec contract methods.
 *
 * Mirrors wagmi's `useReadContract` API: pass params declaratively and the
 * hook auto-fetches, caches, deduplicates, and refetches as needed.
 *
 * Returns the full TanStack `UseQueryResult` object.
 *
 * @example
 * ```tsx
 * const result = useReadContract({
 *   scopeKey: ['tokenBalance', tokenAddress, ownerAddress],
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
): UseQueryResult<TSelectData, Error> => {
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
    (queryEnabled ?? true) &&
      client &&
      params.address &&
      params.args !== undefined
  );

  const scopePrefix = normalizeScopeKey(params.scopeKey);
  const queryKey = [
    ...scopePrefix,
    'readContract',
    params.address,
    String(params.functionName),
    normalizeQueryKeyValue(params.args),
  ];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!client) {
        throw new AztecClientNotReady();
      }
      if (!params.address || params.args === undefined) {
        throw new Error('Missing required parameters');
      }

      return readContractAction(client, {
        contract: params.contract,
        address: params.address,
        functionName: params.functionName,
        args: params.args,
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
};
