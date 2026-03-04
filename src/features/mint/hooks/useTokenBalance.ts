import { useMemo, useCallback } from 'react';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '@aztec-wallet';
import { useContract } from '@contract-registry';
import { useReadContracts } from '@use-aztec';
import { queryKeys } from '../../../hooks/queries/queryKeys';
import { mintFeatureContracts } from '../config/contracts';

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
 * Delegates to useReadContracts for batched wallet-agnostic contract reads.
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

  const tokenAddress = mintFeatureContracts.token.address(currentConfig);
  const ownerAddress = account?.getAddress().toString() ?? '';

  const isQueryEnabled = Boolean(
    !isWalletLoading &&
      isTokenReady &&
      account &&
      tokenAddress &&
      ownerAddress &&
      (options.enabled ?? true)
  );

  const args = useMemo(
    () => (ownerAddress ? [AztecAddress.fromString(ownerAddress)] : undefined),
    [ownerAddress]
  );

  const { data, isLoading, isFetching, isError, error } = useReadContracts({
    scopeKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    contracts: args
      ? [
          {
            contract: TokenContract,
            address: tokenAddress,
            functionName: 'balance_of_private',
            args,
          },
          {
            contract: TokenContract,
            address: tokenAddress,
            functionName: 'balance_of_public',
            args,
          },
        ]
      : [],
    allowFailure: false,
    query: {
      enabled: isQueryEnabled,
      staleTime: 60_000,
    },
  });

  const tokenBalance = useMemo((): TokenBalance | null => {
    if (!data || !Array.isArray(data) || data.length < 2) return null;
    return {
      private: BigInt(String(data[0] ?? 0)),
      public: BigInt(String(data[1] ?? 0)),
    };
  }, [data]);

  const formattedBalances = useMemo((): FormattedBalances | null => {
    if (!tokenBalance) return null;

    const formatBalance = (balance: bigint): string => balance.toString();

    return {
      private: formatBalance(tokenBalance.private),
      public: formatBalance(tokenBalance.public),
      total: formatBalance(tokenBalance.private + tokenBalance.public),
    };
  }, [tokenBalance]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    });
  }, [queryClient, tokenAddress, ownerAddress]);

  return {
    tokenBalance,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    formattedBalances,
  };
};
