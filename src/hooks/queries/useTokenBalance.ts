import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAztecWallet,
  WalletType,
  isBrowserWalletConnector,
} from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { isBrowserWalletPlaceholder, queuePxeCall } from '../../utils';
import { useContractRegistration } from '../context/useContractRegistration';
import { useContractRegistry } from '../context/useContractRegistry';
import { queryKeys } from './queryKeys';
import type { SimulateViewsOp } from '../../types/browserWallet';

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
 * Uses the Token contract directly via useContractRegistration hook.
 * Uses React Query for caching and automatic refetching.
 *
 * For Azguard wallets, uses simulate_views operation instead of direct contract calls.
 *
 * @param options - Configuration options
 * @param options.enabled - Whether to enable the query (defaults to true when wallet is connected)
 */
export const useTokenBalance = (
  options: UseTokenBalanceOptions = {}
): UseTokenBalanceReturn => {
  const { contract: token, isReady: isTokenReady } =
    useContractRegistration('token');

  const {
    account,
    connector,
    isLoading: isWalletLoading,
    currentConfig,
    walletType,
  } = useAztecWallet();
  const { status: registryStatus } = useContractRegistry();
  const queryClient = useQueryClient();

  // Wallet type detection
  const isBrowserWallet = walletType === WalletType.BROWSER_WALLET;
  const isExternalSigner = walletType === WalletType.EXTERNAL_SIGNER;
  const tokenAddress = token?.address.toString() ?? '';
  const ownerAddress = account?.getAddress().toString() ?? '';

  if (isExternalSigner) {
    console.log('[useTokenBalance] EXTERNAL_SIGNER detected', {
      walletType,
      hasToken: !!token,
      isTokenReady,
      hasAccount: !!account,
      tokenAddress,
      ownerAddress,
      registryStatus,
    });
  }

  const isRegistryReady = isBrowserWallet || registryStatus === 'ready';
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
      (!isBrowserWallet ||
        (isBrowserWalletConnector(connector) && connector.getCaipAccount()))
  );

  const query = useQuery({
    queryKey: queryKeys.token.balance(tokenAddress, ownerAddress),
    queryFn: async (): Promise<TokenBalance> => {
      if (!token || !ownerAddress) {
        throw new Error('Token contract or owner address not available');
      }

      // Log when external signer fetches balance
      if (isExternalSigner) {
        console.log('[useTokenBalance] EXTERNAL_SIGNER fetching balance...', {
          tokenAddress,
          ownerAddress,
          tokenType: token?.constructor?.name,
        });
      }

      const useOperationsFlow =
        isBrowserWallet && isBrowserWalletPlaceholder(token);

      // Type guard needed here to access browser wallet specific methods
      if (useOperationsFlow && isBrowserWalletConnector(connector)) {
        const selectedAccount = connector.getCaipAccount();
        if (!selectedAccount) {
          throw new Error('External wallet account not selected');
        }

        const tokenContractAddress =
          contractsConfig.token.address(currentConfig);
        const accountAddress = account!.getAddress().toString();

        const operation: SimulateViewsOp = {
          kind: 'simulate_views',
          account: selectedAccount,
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

        const result = await connector.executeOperation(operation);

        if (result.status !== 'ok') {
          const errorMessage =
            'error' in result ? result.error : 'Failed to fetch balance';
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
        token.methods
          .balance_of_private(fromAddress)
          .simulate({ from: fromAddress })
      );

      const publicBalance = await queuePxeCall(() =>
        token.methods
          .balance_of_public(fromAddress)
          .simulate({ from: fromAddress })
      );

      return {
        private: privateBalance as bigint,
        public: publicBalance as bigint,
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
    isFetching: query.isFetching, // True during background refetch
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
  const { contract: token } = useContractRegistration('token');

  const queryClient = useQueryClient();

  const tokenAddress = token?.address.toString() ?? '';

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
