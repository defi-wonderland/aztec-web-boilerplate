import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContractRegistration } from '../context/useContractRegistration';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useAztecWallet } from '../context/useAztecWallet';
import { queryKeys } from '../queries/queryKeys';
import type { ContractConfigMap } from '../../contract-registry';
import type { DripperContract } from '../../artifacts/Dripper';
import type { TokenContract } from '../../artifacts/Token';

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

  const { activeAccount } = useUniversalWallet();
  const { wallet, getSponsoredFeePaymentMethod } = useAztecWallet();
  const queryClient = useQueryClient();

  const isReady = isDripperReady && isTokenReady && !!wallet;

  const invalidateBalances = () => {
    const ownerAddress = activeAccount?.getAddress().toString();
    if (ownerAddress && token) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.token.balance(token.address.toString(), ownerAddress),
      });
    }
  };

  const dripToPrivate = useMutation({
    mutationFn: async ({ amount }: DripParams) => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!token || !isTokenReady) {
        throw new Error('Token contract not ready');
      }
      if (!wallet) {
        throw new Error('Wallet not available');
      }

      const accounts = await wallet.getAccounts();
      if (accounts.length === 0) {
        throw new Error('No accounts in wallet');
      }
      const fromAddress = accounts[0].item;
      const paymentMethod = await getSponsoredFeePaymentMethod();

      await dripper.methods
        .drip_to_private(token.address, amount)
        .send({
          from: fromAddress,
          fee: { paymentMethod },
        })
        .wait({ timeout: 120 });
    },
    onSuccess: () => {
      invalidateBalances();
      options.onDripToPrivateSuccess?.();
    },
    onError: (error: Error) => {
      options.onDripToPrivateError?.(error);
    },
  });

  const dripToPublic = useMutation({
    mutationFn: async ({ amount }: DripParams) => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!token || !isTokenReady) {
        throw new Error('Token contract not ready');
      }
      if (!wallet) {
        throw new Error('Wallet not available');
      }

      const accounts = await wallet.getAccounts();
      if (accounts.length === 0) {
        throw new Error('No accounts in wallet');
      }
      const fromAddress = accounts[0].item;
      const paymentMethod = await getSponsoredFeePaymentMethod();

      await dripper.methods
        .drip_to_public(token.address, amount)
        .send({
          from: fromAddress,
          fee: { paymentMethod },
        })
        .wait({ timeout: 120 });
    },
    onSuccess: () => {
      invalidateBalances();
      options.onDripToPublicSuccess?.();
    },
    onError: (error: Error) => {
      options.onDripToPublicError?.(error);
    },
  });

  const syncPrivateState = useMutation({
    mutationFn: async () => {
      if (!dripper || !isDripperReady) {
        throw new Error('Dripper contract not ready');
      }
      if (!wallet) {
        throw new Error('Wallet not available');
      }

      const accounts = await wallet.getAccounts();
      if (accounts.length === 0) {
        throw new Error('No accounts in wallet');
      }
      const fromAddress = accounts[0].item;
      const paymentMethod = await getSponsoredFeePaymentMethod();

      await dripper.methods
        .sync_private_state()
        .send({
          from: fromAddress,
          fee: { paymentMethod },
        })
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
