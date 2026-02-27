import { DripperContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';
import { useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { useWriteContract } from '../../use-aztec';
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
  const { account, currentConfig } = useAztecWallet();
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

  const privateDrip = useWriteContract({
    mutation: {
      onSuccess: () => {
        invalidateAllBalances();
        options.onDripToPrivateSuccess?.();
      },
      onError: (error) => {
        options.onDripToPrivateError?.(error);
      },
    },
  });

  const publicDrip = useWriteContract({
    mutation: {
      onSuccess: () => {
        invalidateAllBalances();
        options.onDripToPublicSuccess?.();
      },
      onError: (error) => {
        options.onDripToPublicError?.(error);
      },
    },
  });

  const dripToPrivate = async ({ amount, feePaymentMethod }: DripParams) => {
    if (!dripperAddress || !tokenAddress) {
      throw new Error('Contract addresses not configured');
    }

    await privateDrip
      .writeContractAsync({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_private',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      })
      .catch(() => {});
  };

  const dripToPublic = async ({ amount, feePaymentMethod }: DripParams) => {
    if (!dripperAddress || !tokenAddress) {
      throw new Error('Contract addresses not configured');
    }

    await publicDrip
      .writeContractAsync({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_public',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      })
      .catch(() => {});
  };

  const isPending = privateDrip.isPending || publicDrip.isPending;
  const isError = privateDrip.isError || publicDrip.isError;
  const error = privateDrip.error || publicDrip.error;

  const reset = () => {
    privateDrip.reset();
    publicDrip.reset();
  };

  return {
    dripToPrivate,
    dripToPublic,
    isPending,
    isError,
    error,
    reset,
    isReady,
  };
};
