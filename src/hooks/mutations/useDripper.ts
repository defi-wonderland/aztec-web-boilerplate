import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAztecWallet } from '../context';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { queryKeys } from '../queries/queryKeys';

interface DripParams {
  tokenAddress: string;
  amount: bigint;
}

interface UseDripperMutationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for minting tokens to private balance.
 * Automatically invalidates token balance query on success.
 */
export const useDripToPrivate = (options: UseDripperMutationOptions = {}) => {
  const { dripperService } = useAztecWallet();
  const { activeAccount } = useUniversalWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tokenAddress, amount }: DripParams) => {
      if (!dripperService) {
        throw new Error('Dripper service not available');
      }
      await dripperService.dripToPrivate(tokenAddress, amount);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific token balance query
      const ownerAddress = activeAccount?.getAddress().toString();
      if (ownerAddress) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.token.balance(variables.tokenAddress, ownerAddress),
        });
      }
      options.onSuccess?.();
    },
    onError: (error: Error) => {
      options.onError?.(error);
    },
  });
};

/**
 * Hook for minting tokens to public balance.
 * Automatically invalidates token balance query on success.
 */
export const useDripToPublic = (options: UseDripperMutationOptions = {}) => {
  const { dripperService } = useAztecWallet();
  const { activeAccount } = useUniversalWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tokenAddress, amount }: DripParams) => {
      if (!dripperService) {
        throw new Error('Dripper service not available');
      }
      await dripperService.dripToPublic(tokenAddress, amount);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific token balance query
      const ownerAddress = activeAccount?.getAddress().toString();
      if (ownerAddress) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.token.balance(variables.tokenAddress, ownerAddress),
        });
      }
      options.onSuccess?.();
    },
    onError: (error: Error) => {
      options.onError?.(error);
    },
  });
};

