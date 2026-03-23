import { useMemo, useCallback } from 'react';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { useReadContracts } from '../../use-aztec';
import { toBigInt } from '../../utils';
import { useContract } from '../context/useContract';
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

const selectTokenBalance = (data: unknown): TokenBalance | null => {
  if (!Array.isArray(data) || data.length < 2) return null;
  const [privateBalance, publicBalance] = data;
  return {
    private: toBigInt(publicBalance ?? 0),
    public: toBigInt(privateBalance ?? 0),
  };
};

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

  const tokenAddress = contractsConfig.token.address(currentConfig);
  const ownerAddress = account?.getAddress().toString() ?? '';

  const isQueryEnabled = Boolean(
    !isWalletLoading &&
      isTokenReady &&
      account &&
      tokenAddress &&
      (options.enabled ?? true)
  );

  const args = useMemo(
    () => (ownerAddress ? [AztecAddress.fromString(ownerAddress)] : undefined),
    [ownerAddress]
  );

  const {
    data: tokenBalance,
    isLoading,
    isFetching,
    isError,
    error,
  } = useReadContracts({
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
      staleTime: 100,
      select: selectTokenBalance,
    },
  });

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
    tokenBalance: tokenBalance ?? null,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    formattedBalances,
  };
};
