/**
 * Hook for fetching Fee Juice balance of a fee payer (FPC).
 * Uses React Query for caching and automatic refetching.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { getFeeJuiceBalance } from '@aztec/aztec.js/utils';
import { NetworkService } from '../../services/aztec/network/NetworkService';
import { queryKeys } from './queryKeys';

interface UseFeeJuiceBalanceOptions {
  /** The fee payer address to query balance for */
  feePayerAddress: AztecAddress | null;
  /** The node URL to query */
  nodeUrl: string | undefined;
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
  enabled = true,
}: UseFeeJuiceBalanceOptions): UseFeeJuiceBalanceReturn => {
  const queryClient = useQueryClient();

  const feePayerAddressStr = feePayerAddress?.toString() ?? '';

  const isQueryEnabled = Boolean(
    enabled && feePayerAddress && nodeUrl && feePayerAddressStr
  );

  const query = useQuery({
    queryKey: queryKeys.feeJuice.balance(feePayerAddressStr),
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
    if (feePayerAddressStr) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.feeJuice.balance(feePayerAddressStr),
      });
    }
  }, [queryClient, feePayerAddressStr]);

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
    async (feePayerAddress: string) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.feeJuice.balance(feePayerAddress),
      });
    },
    [queryClient]
  );

  return {
    invalidateAll,
    invalidateBalance,
  };
};
