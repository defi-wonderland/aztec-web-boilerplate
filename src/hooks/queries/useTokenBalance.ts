import { useMemo, useCallback } from 'react';
import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Token.js';
import { useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
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

  const args = useMemo(
    () =>
      ownerAddress
        ? ([AztecAddress.fromString(ownerAddress)] as const)
        : undefined,
    [ownerAddress]
  );

  const privateBalance = useReadContract({
    queryKey: [
      ...queryKeys.token.balance(tokenAddress, ownerAddress),
      'private',
    ] as const,
    contract: TokenContract,
    address: tokenAddress,
    functionName: 'balance_of_private',
    args,
    enabled: isQueryEnabled,
    staleTime: 60_000,
  });

  const publicBalance = useReadContract({
    queryKey: [
      ...queryKeys.token.balance(tokenAddress, ownerAddress),
      'public',
    ] as const,
    contract: TokenContract,
    address: tokenAddress,
    functionName: 'balance_of_public',
    args,
    enabled: isQueryEnabled,
    staleTime: 60_000,
  });

  const tokenBalance = useMemo((): TokenBalance | null => {
    if (privateBalance.data === undefined || publicBalance.data === undefined) {
      return null;
    }
    return {
      private: BigInt(String(privateBalance.data ?? 0)),
      public: BigInt(String(publicBalance.data ?? 0)),
    };
  }, [privateBalance.data, publicBalance.data]);

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
    isLoading: privateBalance.isLoading || publicBalance.isLoading,
    isFetching: privateBalance.isFetching || publicBalance.isFetching,
    isError: privateBalance.isError || publicBalance.isError,
    error: privateBalance.error ?? publicBalance.error,
    refetch,
    formattedBalances,
  };
};
