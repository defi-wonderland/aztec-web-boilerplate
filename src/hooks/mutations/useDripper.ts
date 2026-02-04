import { useRef, useLayoutEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { DripperContract } from '../../artifacts/Dripper';
import { useAztecWallet } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { useWriteContract } from '../contracts/useWriteContract';
import { queryKeys } from '../queries/queryKeys';
import { useFeeJuiceBalanceInvalidation } from '../queries/useFeeJuiceBalance';
import type { FeePaymentMethodType } from '../../config/feePaymentContracts';

interface DripParams {
  amount: bigint;
  /** Fee payment method to use (defaults to 'sponsored') */
  feePaymentMethod?: FeePaymentMethodType;
}

interface UseDripperOptions {
  onDripToPrivateSuccess?: () => void;
  onDripToPrivateError?: (error: Error) => void;
  onDripToPublicSuccess?: () => void;
  onDripToPublicError?: (error: Error) => void;
}

export const useDripper = (options: UseDripperOptions = {}) => {
  // Use ref to avoid stale closures in mutation callbacks
  const callbacksRef = useRef(options);
  // Update ref in layout effect to ensure latest callbacks are available
  useLayoutEffect(() => {
    callbacksRef.current = options;
  });
  const { account, currentConfig } = useAztecWallet();
  const { writeContract } = useWriteContract();
  const queryClient = useQueryClient();
  const { invalidateAll: invalidateFeeJuiceBalances } =
    useFeeJuiceBalanceInvalidation();

  const dripperAddress = contractsConfig.dripper.address(currentConfig);
  const tokenAddress = contractsConfig.token.address(currentConfig);
  const isReady = !!account;

  const invalidateBalance = () => {
    if (!account || !tokenAddress) return;
    const queryKey = queryKeys.token.balance(
      tokenAddress,
      account.getAddress().toString()
    );
    queryClient.invalidateQueries({ queryKey });
  };

  const invalidateAllBalances = () => {
    invalidateBalance();
    invalidateFeeJuiceBalances();
  };

  const dripToPrivate = useMutation({
    retry: false,
    mutationFn: async ({ amount, feePaymentMethod }: DripParams) => {
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
        feePaymentMethod,
      });

      if (!result.success) {
        throw new Error(result.error ?? 'drip_to_private failed');
      }

      invalidateAllBalances();
    },
    onSuccess: () => callbacksRef.current.onDripToPrivateSuccess?.(),
    onError: (error: Error) =>
      callbacksRef.current.onDripToPrivateError?.(error),
  });

  const dripToPublic = useMutation({
    retry: false,
    mutationFn: async ({ amount, feePaymentMethod }: DripParams) => {
      if (!dripperAddress || !tokenAddress) {
        throw new Error('Contract addresses not configured');
      }
      if (!account) {
        throw new Error('Account not available');
      }

      // Simulate first to catch revert reasons before sending
      console.log('[useDripper] Simulating drip_to_public...', {
        dripperAddress,
        tokenAddress,
        amount: amount.toString(),
        account: account.getAddress().toString(),
      });

      const result = await writeContract({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_public',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      });

      if (!result.success) {
        console.error('[useDripper] drip_to_public failed:', result.error);
        throw new Error(result.error ?? 'drip_to_public failed');
      }

      invalidateAllBalances();
    },
    onSuccess: () => callbacksRef.current.onDripToPublicSuccess?.(),
    onError: (error: Error) =>
      callbacksRef.current.onDripToPublicError?.(error),
  });

  return {
    dripToPrivate,
    dripToPublic,
    isReady,
  };
};
