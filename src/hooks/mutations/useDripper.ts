import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { useContractRegistration } from '../context/useContractRegistration';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useConfig } from '../context/useConfig';
import { queryKeys } from '../queries/queryKeys';
import type { ContractConfigMap } from '../../contract-registry';
import type { DripperContract } from '../../artifacts/Dripper';
import type { TokenContract } from '../../artifacts/Token';
import { WalletType } from '../../types/aztec';
import { aztecContracts } from '../../config/contracts';
import { isAzguardProxy } from '../../utils';
import type { TokenBalance } from '../queries/useTokenBalance';

interface DripParams {
  amount: bigint;
}

interface UseDripperOptions {
  onDripToPrivateSuccess?: () => void;
  onDripToPrivateError?: (error: Error) => void;
  onDripToPublicSuccess?: () => void;
  onDripToPublicError?: (error: Error) => void;
  onSyncSuccess?: () => void;
  onSyncError?: (error: Error) => void;
}

/**
 * Hook for all Dripper contract operations.
 * Returns mutation objects for each operation with independent state.
 *
 * @example
 * ```typescript
 * const { dripToPrivate, dripToPublic, syncPrivateState, isReady } = useDripper();
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
  const {
    contract: dripper,
    isReady: isDripperReady,
  } = useContractRegistration<ContractConfigMap, DripperContract>('dripper');

  const {
    contract: token,
    isReady: isTokenReady,
  } = useContractRegistration<ContractConfigMap, TokenContract>('token');

  const { account, walletType, connector } = useUniversalWallet();
  const { currentConfig } = useConfig();
  const queryClient = useQueryClient();
  const getBalanceQueryKey = () => {
    if (!token || !account) {
      return null;
    }

    const tokenAddress = token.address?.toString();
    const ownerAddress = account.getAddress().toString();

    if (!tokenAddress || !ownerAddress) {
      return null;
    }

    return queryKeys.token.balance(tokenAddress, ownerAddress);
  };

  const updateCachedBalance = (
    balanceType: 'private' | 'public',
    amountToAdd: bigint
  ) => {
    if (amountToAdd === 0n) {
      return;
    }

    const queryKey = getBalanceQueryKey();
    if (!queryKey) {
      return;
    }

    queryClient.setQueryData<TokenBalance | undefined>(queryKey, (previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        [balanceType]: previous[balanceType] + amountToAdd,
      };
    });
  };

  const isAzguardWallet = walletType === WalletType.AZGUARD;
  const supportsOperations =
    Boolean(connector?.capabilities.canExecuteOperations) && typeof connector?.sendTransaction === 'function';
  const supportsSponsoredFees =
    Boolean(connector?.capabilities.hasSponsoredFees) && typeof connector?.getSponsoredFeePaymentMethod === 'function';

  const isReady = isDripperReady && isTokenReady && !!account;

  const invalidateBalances = () => {
    const balanceQueryKey = getBalanceQueryKey();
    if (!balanceQueryKey) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: balanceQueryKey,
    });
  };

  const dripToPrivate = useMutation({
    retry: false,
    mutationFn: async ({ amount }: DripParams) => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!token || !isTokenReady) {
        throw new Error('Token contract not ready');
      }
      if (!account) {
        throw new Error('Account not available');
      }

      if (supportsOperations && isAzguardProxy(dripper) && isAzguardProxy(token)) {
        if (!connector) {
          throw new Error('No wallet connector available');
        }

        const selectedAccount = connector.getCaipAccount?.();
        if (!selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const dripperAddress = aztecContracts.dripper.address(currentConfig);
        const tokenAddress = aztecContracts.token.address(currentConfig);

        const response = await connector.sendTransaction({
          actions: [
            {
              contract: dripperAddress,
              method: 'drip_to_private',
              args: [tokenAddress, amount.toString()],
            },
          ],
        });

        if (response.status !== 'success') {
          throw new Error(response.error ?? 'drip_to_private failed');
        }

        return;
      }

      const fromAddress = account.getAddress();
      const sendOptions: {
        from: ReturnType<typeof account.getAddress>;
        fee?: { paymentMethod: SponsoredFeePaymentMethod };
      } = { from: fromAddress };

      if (supportsSponsoredFees && connector?.getSponsoredFeePaymentMethod) {
        const paymentMethod = await connector.getSponsoredFeePaymentMethod();
        sendOptions.fee = { paymentMethod };
      }

      await (dripper as DripperContract).methods
        .drip_to_private((token as TokenContract).address, amount)
        .send(sendOptions)
        .wait({ timeout: 120 });
    },
    onSuccess: (_data, variables) => {
      if (isAzguardWallet) {
        updateCachedBalance('private', variables?.amount ?? 0n);
      } else {
        invalidateBalances();
      }
      options.onDripToPrivateSuccess?.();
    },
    onError: (error: Error) => {
      options.onDripToPrivateError?.(error);
    },
  });

  const dripToPublic = useMutation({
    retry: false,
    mutationFn: async ({ amount }: DripParams) => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!token || !isTokenReady) {
        throw new Error('Token contract not ready');
      }
      if (!account) {
        throw new Error('Account not available');
      }

      if (supportsOperations && isAzguardProxy(dripper) && isAzguardProxy(token)) {
        if (!connector) {
          throw new Error('No wallet connector available');
        }

        const selectedAccount = connector.getCaipAccount?.();
        if (!selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const dripperAddress = aztecContracts.dripper.address(currentConfig);
        const tokenAddress = aztecContracts.token.address(currentConfig);

        const response = await connector.sendTransaction({
          actions: [
            {
              contract: dripperAddress,
              method: 'drip_to_public',
              args: [tokenAddress, amount.toString()],
            },
          ],
        });

        if (response.status !== 'success') {
          throw new Error(response.error ?? 'drip_to_public failed');
        }

        return;
      }

      const fromAddress = account.getAddress();
      const sendOptions: {
        from: ReturnType<typeof account.getAddress>;
        fee?: { paymentMethod: SponsoredFeePaymentMethod };
      } = { from: fromAddress };

      if (supportsSponsoredFees && connector?.getSponsoredFeePaymentMethod) {
        const paymentMethod = await connector.getSponsoredFeePaymentMethod();
        sendOptions.fee = { paymentMethod };
      }

      await (dripper as DripperContract).methods
        .drip_to_public((token as TokenContract).address, amount)
        .send(sendOptions)
        .wait({ timeout: 120 });
    },
    onSuccess: (_data, variables) => {
      if (isAzguardWallet) {
        updateCachedBalance('public', variables?.amount ?? 0n);
      } else {
        invalidateBalances();
      }
      options.onDripToPublicSuccess?.();
    },
    onError: (error: Error) => {
      options.onDripToPublicError?.(error);
    },
  });

  const syncPrivateState = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!account) {
        throw new Error('Account not available');
      }

      if (supportsOperations && isAzguardProxy(dripper)) {
        if (!connector) {
          throw new Error('No wallet connector available');
        }

        const selectedAccount = connector.getCaipAccount?.();
        if (!selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const dripperAddress = aztecContracts.dripper.address(currentConfig);

        const response = await connector.sendTransaction({
          actions: [
            {
              contract: dripperAddress,
              method: 'sync_private_state',
              args: [],
            },
          ],
        });

        if (response.status !== 'success') {
          throw new Error(response.error ?? 'sync_private_state failed');
        }

        return;
      }

      const fromAddress = account.getAddress();
      const sendOptions: {
        from: ReturnType<typeof account.getAddress>;
        fee?: { paymentMethod: SponsoredFeePaymentMethod };
      } = { from: fromAddress };

      if (supportsSponsoredFees && connector?.getSponsoredFeePaymentMethod) {
        const paymentMethod = await connector.getSponsoredFeePaymentMethod();
        sendOptions.fee = { paymentMethod };
      }

      await (dripper as DripperContract).methods
        .sync_private_state()
        .send(sendOptions)
        .wait({ timeout: 120 });
    },
    onSuccess: () => {
      options.onSyncSuccess?.();
    },
    onError: (error: Error) => {
      options.onSyncError?.(error);
    },
  });

  return {
    dripToPrivate,
    dripToPublic,
    syncPrivateState,
    isReady,
  };
};
