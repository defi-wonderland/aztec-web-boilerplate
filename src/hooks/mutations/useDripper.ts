import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useWriteContract } from '../contracts/useWriteContract';
import { queryKeys } from '../queries/queryKeys';
import { DripperContract } from '../../artifacts/Dripper';
import { aztecContracts } from '../../config/contracts';
import { isBrowserWalletConnector } from '../../types/walletConnector';
import type { TokenBalance } from '../queries/useTokenBalance';

interface DripParams {
  amount: bigint;
}

interface UseDripperOptions {
  onDripToPrivateSuccess?: () => void;
  onDripToPrivateError?: (error: Error) => void;
  onDripToPublicSuccess?: () => void;
  onDripToPublicError?: (error: Error) => void;
}

/**
 * Hook for Dripper contract operations.
 * Returns mutation objects for each operation with independent state.
 *
 * @example
 * ```typescript
 * const { dripToPrivate, dripToPublic, isReady } = useDripper();
 *
 * // Drip tokens
 * dripToPrivate.mutate({ amount: 1000n });
 *
 * // Check loading state
 * if (dripToPrivate.isPending) {
 *   return <Loading />;
 * }
 * ```
 */
export const useDripper = (options: UseDripperOptions = {}) => {
  const { account, connector, currentConfig } = useUniversalWallet();
  const { writeContract } = useWriteContract();
  const queryClient = useQueryClient();

  const isExternal = isBrowserWalletConnector(connector);
  const dripperAddress = aztecContracts.dripper.address(currentConfig);
  const tokenAddress = aztecContracts.token.address(currentConfig);
  const isReady = !!account && !!connector;

  const getBalanceQueryKey = () => {
    if (!account) return null;
    const ownerAddress = account.getAddress().toString();
    if (!tokenAddress || !ownerAddress) return null;
    return queryKeys.token.balance(tokenAddress, ownerAddress);
  };

  const updateCachedBalance = (
    balanceType: 'private' | 'public',
    amountToAdd: bigint
  ) => {
    if (amountToAdd === 0n) return;

    const queryKey = getBalanceQueryKey();
    if (!queryKey) return;

    queryClient.setQueryData<TokenBalance | undefined>(queryKey, (previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        [balanceType]: previous[balanceType] + amountToAdd,
      };
    });
  };

  const invalidateBalances = () => {
    const balanceQueryKey = getBalanceQueryKey();
    if (!balanceQueryKey) return;
    queryClient.invalidateQueries({ queryKey: balanceQueryKey });
  };

  const dripToPrivate = useMutation({
    retry: false,
    mutationFn: async ({ amount }: DripParams) => {
      if (!dripperAddress || !tokenAddress) {
        throw new Error('Contract addresses not configured');
      }
      if (!account) {
        throw new Error('Account not available');
      }

      const result = await writeContract({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_private',
        args: [AztecAddress.fromString(tokenAddress), amount],
      });

      if (!result.success) {
        throw new Error(result.error ?? 'drip_to_private failed');
      }
    },
    onSuccess: (_data, variables) => {
      if (isExternal) {
        updateCachedBalance('private', variables?.amount ?? 0n);
      }
      invalidateBalances();
      options.onDripToPrivateSuccess?.();
    },
    onError: (error: Error) => {
      options.onDripToPrivateError?.(error);
    },
  });

  const dripToPublic = useMutation({
    retry: false,
    mutationFn: async ({ amount }: DripParams) => {
      if (!dripperAddress || !tokenAddress) {
        throw new Error('Contract addresses not configured');
      }
      if (!account) {
        throw new Error('Account not available');
      }

      const result = await writeContract({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_public',
        args: [AztecAddress.fromString(tokenAddress), amount],
      });

      if (!result.success) {
        throw new Error(result.error ?? 'drip_to_public failed');
      }
    },
    onSuccess: (_data, variables) => {
      if (isExternal) {
        updateCachedBalance('public', variables?.amount ?? 0n);
      }
      invalidateBalances();
      options.onDripToPublicSuccess?.();
    },
    onError: (error: Error) => {
      options.onDripToPublicError?.(error);
    },
  });

  return {
    dripToPrivate,
    dripToPublic,
    isReady,
  };
};
