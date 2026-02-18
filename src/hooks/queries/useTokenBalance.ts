import { useMemo, useCallback } from 'react';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { queuePxeCall } from '../../utils';
import { useContract } from '../context/useContract';
import { useReadContract } from '../contracts/useReadContract';
import { queryKeys } from './queryKeys';

export interface TokenBalance {
  private: bigint;
  public: bigint;
}

export interface FormattedBalances {
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
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  formattedBalances: FormattedBalances | null;
}

/**
 * Hook to fetch token balance for the connected account.
 * Delegates to useReadContract for wallet-agnostic contract reads.
 * Uses React Query for caching and automatic refetching.
 *
 * @param options - Configuration options
 * @param options.enabled - Whether to enable the query (defaults to true when wallet is connected)
 */
export const useTokenBalance = (
  options: UseTokenBalanceOptions = {}
): UseTokenBalanceReturn => {
  const { isReady: isTokenReady } = useContract('token');

  const {
    account,
    isLoading: isWalletLoading,
    currentConfig,
  } = useAztecWallet();
  const queryClient = useQueryClient();
  const { readContracts } = useReadContract();

  const tokenAddress = contractsConfig.token.address(currentConfig);
  const ownerAddress = account?.getAddress().toString() ?? '';

  const isQueryEnabled = Boolean(
    !isWalletLoading &&
      isTokenReady &&
      account &&
      tokenAddress &&
      ownerAddress &&
      (options.enabled ?? true)
  );

  const query = useQuery({
    queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    queryFn: async (): Promise<TokenBalance> => {
      if (!tokenAddress || !ownerAddress) {
        throw new Error('Token contract or owner address not available');
      }

      const owner = AztecAddress.fromString(ownerAddress);

      const [privateResult, publicResult] = await queuePxeCall(() =>
        readContracts([
          {
            contract: TokenContract,
            address: tokenAddress,
            functionName: 'balance_of_private',
            args: [owner],
          },
          {
            contract: TokenContract,
            address: tokenAddress,
            functionName: 'balance_of_public',
            args: [owner],
          },
        ])
      );

      if (!privateResult.success) {
        throw new Error(
          privateResult.error ?? 'Failed to fetch private balance'
        );
      }

      if (!publicResult.success) {
        throw new Error(publicResult.error ?? 'Failed to fetch public balance');
      }

      return {
        private: BigInt(String(privateResult.data ?? 0)),
        public: BigInt(String(publicResult.data ?? 0)),
      };
    },
    enabled: isQueryEnabled,
    staleTime: 60_000,
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
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch,
    formattedBalances,
  };
};
