import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { useAztecWallet } from '../context';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useConfig } from '../context/useConfig';
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
  tokenAddress?: string;
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
 * Uses React Query for caching and automatic refetching.
 * 
 * @param options - Configuration options
 * @param options.tokenAddress - Override the default token address from config
 * @param options.enabled - Whether to enable the query (defaults to true when wallet is connected)
 */
export const useTokenBalance = (options: UseTokenBalanceOptions = {}): UseTokenBalanceReturn => {
  const { tokenService } = useAztecWallet();
  const { activeAccount } = useUniversalWallet();
  const { currentConfig } = useConfig();
  const queryClient = useQueryClient();

  const tokenAddress = options.tokenAddress ?? currentConfig.tokenContractAddress ?? '';
  const ownerAddress = activeAccount?.getAddress().toString() ?? '';

  const isQueryEnabled = Boolean(
    tokenService &&
    activeAccount &&
    tokenAddress &&
    ownerAddress &&
    (options.enabled ?? true)
  );

  const query = useQuery({
    queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    queryFn: async (): Promise<TokenBalance> => {
      if (!tokenService || !ownerAddress) {
        throw new Error('Token service or owner address not available');
      }

      // Sequential calls to avoid PXE concurrency issues
      const privateBalance = await tokenService.getPrivateBalance(tokenAddress, ownerAddress);
      const publicBalance = await tokenService.getPublicBalance(tokenAddress, ownerAddress);

      return {
        private: privateBalance,
        public: publicBalance,
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
 * Hook to manage token address state alongside balance fetching.
 * Provides a complete replacement for the old TokenProvider functionality.
 */
export const useTokenWithAddress = () => {
  const { currentConfig } = useConfig();
  const { activeAccount } = useUniversalWallet();
  const queryClient = useQueryClient();

  const defaultTokenAddress = currentConfig.tokenContractAddress ?? '';

  /**
   * Invalidate all token balance queries.
   * Useful when network changes or when balances need to be refreshed globally.
   */
  const invalidateAllBalances = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.token.balances(),
    });
  }, [queryClient]);

  /**
   * Prefetch a token balance for better UX.
   */
  const prefetchBalance = useCallback(
    async (tokenAddress: string, tokenService: { getPrivateBalance: (addr: string, owner: string) => Promise<bigint>; getPublicBalance: (addr: string, owner: string) => Promise<bigint> }) => {
      const ownerAddress = activeAccount?.getAddress().toString();
      if (!ownerAddress) return;

      await queryClient.prefetchQuery({
        queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
        queryFn: async () => {
          const privateBalance = await tokenService.getPrivateBalance(tokenAddress, ownerAddress);
          const publicBalance = await tokenService.getPublicBalance(tokenAddress, ownerAddress);
          return { private: privateBalance, public: publicBalance };
        },
      });
    },
    [queryClient, activeAccount]
  );

  return {
    defaultTokenAddress,
    invalidateAllBalances,
    prefetchBalance,
  };
};


