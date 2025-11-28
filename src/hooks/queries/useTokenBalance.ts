import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { useTokenContract } from '../context/useTokenContract';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { queryKeys } from './queryKeys';

interface TokenBalance {
  private: bigint;
  public: bigint;
}

interface FormattedBalances {
  private: string;
  public: string;
  total: string;
}

interface UseTokenBalanceOptions {
  enabled?: boolean;
}

interface UseTokenBalanceReturn {
  tokenBalance: TokenBalance | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  formattedBalances: FormattedBalances | null;
}

/**
 * Hook to fetch token balance for the connected account.
 * Uses the Token contract directly via useTokenContract hook.
 * Uses React Query for caching and automatic refetching.
 * 
 * @param options - Configuration options
 * @param options.enabled - Whether to enable the query (defaults to true when wallet is connected)
 */
export const useTokenBalance = (options: UseTokenBalanceOptions = {}): UseTokenBalanceReturn => {
  const { token, isReady: isTokenReady } = useTokenContract();
  const { activeAccount } = useUniversalWallet();
  const queryClient = useQueryClient();

  const tokenAddress = token?.address.toString() ?? '';
  const ownerAddress = activeAccount?.getAddress().toString() ?? '';

  const isQueryEnabled = Boolean(
    token &&
    isTokenReady &&
    activeAccount &&
    tokenAddress &&
    ownerAddress &&
    (options.enabled ?? true)
  );

  const query = useQuery({
    queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    queryFn: async (): Promise<TokenBalance> => {
      if (!token || !ownerAddress) {
        throw new Error('Token contract or owner address not available');
      }

      // Sequential calls to avoid PXE concurrency issues
      const fromAddress = activeAccount!.getAddress();
      
      const privateBalance = await token.methods
        .balance_of_private(fromAddress)
        .simulate({ from: fromAddress });
      
      const publicBalance = await token.methods
        .balance_of_public(fromAddress)
        .simulate({ from: fromAddress });

      return {
        private: privateBalance as bigint,
        public: publicBalance as bigint,
      };
    },
    enabled: isQueryEnabled,
    staleTime: 30_000,
  });

  const formattedBalances = useMemo((): FormattedBalances | null => {
    if (!query.data) return null;

    const formatBalance = (balance: bigint): string => balance.toString();

    return {
      private: formatBalance(query.data.private),
      public: formatBalance(query.data.public),
      total: formatBalance(query.data.private + query.data.public),
    };
  }, [query.data]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    });
  }, [queryClient, tokenAddress, ownerAddress]);

  return {
    tokenBalance: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
    formattedBalances,
  };
};

/**
 * Hook to manage token balance utilities.
 */
export const useTokenWithAddress = () => {
  const { token } = useTokenContract();
  const queryClient = useQueryClient();

  const tokenAddress = token?.address.toString() ?? '';

  /**
   * Invalidate all token balance queries.
   * Useful when network changes or when balances need to be refreshed globally.
   */
  const invalidateAllBalances = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.token.balances(),
    });
  }, [queryClient]);

  return {
    tokenAddress,
    invalidateAllBalances,
  };
};
