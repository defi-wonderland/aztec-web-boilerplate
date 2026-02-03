/**
 * Hook for fetching Fee Juice balance of a fee payer (FPC).
 * Uses React Query for caching and automatic refetching.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { getFeeJuiceBalance } from '@aztec/aztec.js/utils';
import { NetworkService } from '../../aztec-wallet/services/aztec/network';
import { queryKeys } from './queryKeys';
import type { AztecNetwork } from '../../config/networks/constants';

interface UseFeeJuiceBalanceOptions {
  /** The fee payer address to query balance for */
  feePayerAddress: AztecAddress | null;
  /** The node URL to query */
  nodeUrl: string | undefined;
  /** The network name for cache key isolation */
  networkName: AztecNetwork | undefined;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseFeeJuiceBalanceReturn {
  balance: bigint | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch Fee Juice balance for a fee payer address.
 */
export const useFeeJuiceBalance = ({
  feePayerAddress,
  nodeUrl,
  networkName,
  enabled = true,
}: UseFeeJuiceBalanceOptions): UseFeeJuiceBalanceReturn => {
  const queryClient = useQueryClient();

  const feePayerAddressStr = feePayerAddress?.toString() ?? '';

  const isQueryEnabled = Boolean(
    enabled && feePayerAddress && nodeUrl && feePayerAddressStr && networkName
  );

  const query = useQuery({
    queryKey: queryKeys.feeJuice.balance(
      networkName ?? 'devnet',
      feePayerAddressStr
    ),
    queryFn: async (): Promise<bigint> => {
      if (!feePayerAddress || !nodeUrl) {
        throw new Error('Fee payer address or node URL not available');
      }

      const node = NetworkService.getNodeClient(nodeUrl);
      return getFeeJuiceBalance(feePayerAddress, node);
    },
    enabled: isQueryEnabled,
    staleTime: 30_000, // Consider stale after 30 seconds
  });

  const refetch = useCallback(async () => {
    if (feePayerAddressStr && networkName) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.feeJuice.balance(networkName, feePayerAddressStr),
      });
    }
  }, [queryClient, networkName, feePayerAddressStr]);

  return {
    balance: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
};

/**
 * Hook to get utilities for invalidating Fee Juice balances.
 */
export const useFeeJuiceBalanceInvalidation = () => {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.feeJuice.balances(),
    });
  }, [queryClient]);

  const invalidateBalance = useCallback(
    async (networkName: AztecNetwork, feePayerAddress: string) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.feeJuice.balance(networkName, feePayerAddress),
      });
    },
    [queryClient]
  );

  return {
    invalidateAll,
    invalidateBalance,
  };
};
