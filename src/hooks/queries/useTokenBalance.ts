import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import type { SimulateViewsOperation } from '@azguardwallet/types';
import { useContractRegistration } from '../context/useContractRegistration';
import { useContractRegistry } from '../context/useContractRegistry';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useConfig } from '../context/useConfig';
import { queryKeys } from './queryKeys';
import { aztecContracts } from '../../config/contracts';
import { WalletType } from '../../types/aztec';
import { isAzguardProxy, queuePxeCall } from '../../utils';
import type { ContractConfigMap } from '../../contract-registry';
import type { TokenContract } from '../../artifacts/Token';

export interface TokenBalance {
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
 * Uses the Token contract directly via useContractRegistration hook.
 * Uses React Query for caching and automatic refetching.
 * 
 * For Azguard wallets, uses simulate_views operation instead of direct contract calls.
 * 
 * @param options - Configuration options
 * @param options.enabled - Whether to enable the query (defaults to true when wallet is connected)
 */
export const useTokenBalance = (options: UseTokenBalanceOptions = {}): UseTokenBalanceReturn => {
  const {
    contract: token,
    isReady: isTokenReady,
  } = useContractRegistration<ContractConfigMap, TokenContract>('token');

  const { account, walletType, azguard, isLoading: isWalletLoading } = useUniversalWallet();
  const { currentConfig } = useConfig();
  const { status: registryStatus } = useContractRegistry();
  const queryClient = useQueryClient();

  const isAzguardWallet = walletType === WalletType.AZGUARD;
  const tokenAddress = token?.address.toString() ?? '';
  const ownerAddress = account?.getAddress().toString() ?? '';

  // Wait for both registry and wallet to be fully ready before running balance queries
  // This prevents PXE concurrency issues when contract registration or wallet initialization is in progress
  const isRegistryReady = registryStatus === 'ready';
  const isWalletReady = !isWalletLoading;

  const isQueryEnabled = Boolean(
    isRegistryReady &&
    isWalletReady &&
    token &&
    isTokenReady &&
    account &&
    tokenAddress &&
    ownerAddress &&
    (options.enabled ?? true) &&
    (!isAzguardWallet || (azguard.state.isConnected && azguard.state.selectedAccount))
  );

  const query = useQuery({
    queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    queryFn: async (): Promise<TokenBalance> => {
      if (!token || !ownerAddress) {
        throw new Error('Token contract or owner address not available');
      }

      if (isAzguardWallet && isAzguardProxy(token)) {
        if (!azguard.state.selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const tokenContractAddress = aztecContracts.token.address(currentConfig);
        const accountAddress = account!.getAddress().toString();

        const operation: SimulateViewsOperation = {
          kind: 'simulate_views',
          account: azguard.state.selectedAccount,
          calls: [
            {
              kind: 'call',
              contract: tokenContractAddress,
              method: 'balance_of_private',
              args: [accountAddress],
            },
            {
              kind: 'call',
              contract: tokenContractAddress,
              method: 'balance_of_public',
              args: [accountAddress],
            },
          ],
        };

        const results = await azguard.executeOperations([operation]);
        const result = results[0];

        if (result.status !== 'ok') {
          const errorMessage = 'error' in result ? result.error : 'Failed to fetch balance';
          throw new Error(errorMessage || 'Balance query failed');
        }

        // Result contains decoded values for each call
        const viewResult = result.result as { decoded: unknown[] };
        const privateBalance = BigInt(String(viewResult.decoded[0] ?? 0));
        const publicBalance = BigInt(String(viewResult.decoded[1] ?? 0));

        return {
          private: privateBalance,
          public: publicBalance,
        };
      }

      const fromAddress = account!.getAddress();
      
      const privateBalance = await queuePxeCall(() =>
        (token as TokenContract).methods
          .balance_of_private(fromAddress)
          .simulate({ from: fromAddress })
      );

      const publicBalance = await queuePxeCall(() =>
        (token as TokenContract).methods
          .balance_of_public(fromAddress)
          .simulate({ from: fromAddress })
      );

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
  const {
    contract: token,
  } = useContractRegistration<ContractConfigMap, TokenContract>('token');

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
