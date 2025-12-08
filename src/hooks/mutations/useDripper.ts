import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContractRegistration } from '../context/useContractRegistration';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { queryKeys } from '../queries/queryKeys';
import type { ContractConfigMap } from '../../contract-registry';
import type { DripperContract } from '../../artifacts/Dripper';
import type { TokenContract } from '../../artifacts/Token';
import { aztecContracts } from '../../config/contracts';
import { 
  isBrowserWalletConnector, 
  shouldUseOperationsFlow,
} from '../../utils';
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
  const { contract: dripper, isReady: isDripperReady } =
    useContractRegistration<ContractConfigMap, DripperContract>('dripper');

  const { contract: token, isReady: isTokenReady } = useContractRegistration<
    ContractConfigMap,
    TokenContract
  >('token');

  const { account, connector, currentConfig } = useUniversalWallet();
  const queryClient = useQueryClient();
  
  const isExternal = isBrowserWalletConnector(connector);
  
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
      if (!connector) {
        throw new Error('Wallet connector not available');
      }

      const useOperationsFlow = shouldUseOperationsFlow(connector, dripper, token);
      
      if (useOperationsFlow) {
        const selectedAccount = connector.getCaipAccount?.();
        if (!selectedAccount) {
          throw new Error('External wallet account not selected');
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

      // Direct contract call path - always use sponsored fees
      if (!connector.getSponsoredFeePaymentMethod) {
        throw new Error('Connector does not support sponsored fees');
      }
      
      const fromAddress = account.getAddress();
      const paymentMethod = await connector.getSponsoredFeePaymentMethod();

      await (dripper as DripperContract).methods
        .drip_to_private((token as TokenContract).address, amount)
        .send({
          from: fromAddress,
          fee: { paymentMethod },
        })
        .wait({ timeout: 900 });
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
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!token || !isTokenReady) {
        throw new Error('Token contract not ready');
      }
      if (!account) {
        throw new Error('Account not available');
      }
      if (!connector) {
        throw new Error('Wallet connector not available');
      }

      // Use operations flow for external wallets with proxy contracts
      const useOperationsFlow = shouldUseOperationsFlow(connector, dripper, token);
      
      if (useOperationsFlow) {
        const selectedAccount = connector.getCaipAccount?.();
        if (!selectedAccount) {
          throw new Error('External wallet account not selected');
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

      // Direct contract call path - always use sponsored fees
      if (!connector.getSponsoredFeePaymentMethod) {
        throw new Error('Connector does not support sponsored fees');
      }
      
      const fromAddress = account.getAddress();
      const paymentMethod = await connector.getSponsoredFeePaymentMethod();

      await (dripper as DripperContract).methods
        .drip_to_public((token as TokenContract).address, amount)
        .send({
          from: fromAddress,
          fee: { paymentMethod },
        })
        .wait({ timeout: 900 });
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

  const syncPrivateState = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!account) {
        throw new Error('Account not available');
      }
      if (!connector) {
        throw new Error('Wallet connector not available');
      }

      // Use operations flow for external wallets with proxy contracts
      const useOperationsFlow = shouldUseOperationsFlow(connector, dripper);
      
      if (useOperationsFlow) {
        const selectedAccount = connector.getCaipAccount?.();
        if (!selectedAccount) {
          throw new Error('External wallet account not selected');
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

      // Direct contract call path - always use sponsored fees
      if (!connector.getSponsoredFeePaymentMethod) {
        throw new Error('Connector does not support sponsored fees');
      }
      
      const fromAddress = account.getAddress();
      const paymentMethod = await connector.getSponsoredFeePaymentMethod();

      await (dripper as DripperContract).methods
        .sync_private_state()
        .send({
          from: fromAddress,
          fee: { paymentMethod },
        })
        .wait({ timeout: 900 });
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
