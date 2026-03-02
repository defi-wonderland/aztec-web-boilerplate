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
  const { writeContractAsync: writePrivateAsync, isPending: isPrivatePending } =
    useWriteContract();
  const { writeContractAsync: writePublicAsync, isPending: isPublicPending } =
    useWriteContract();
  const queryClient = useQueryClient();
  const { invalidateAll: invalidateFeeJuiceBalances } =
    useFeeJuiceBalanceInvalidation();

  const dripperAddress = contractsConfig.dripper.address(currentConfig);
  const tokenAddress = contractsConfig.token.address(currentConfig);
  const isReady = !!account && !!dripperAddress && !!tokenAddress;

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

  const dripToPrivate = async ({ amount, feePaymentMethod }: DripParams) => {
    if (!dripperAddress || !tokenAddress || !account) {
      options.onDripToPrivateError?.(
        new Error('Contract addresses not configured')
      );
      return;
    }

    return writePrivateAsync(
      {
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_private',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      },
      {
        onSuccess: () => {
          invalidateAllBalances();
          options.onDripToPrivateSuccess?.();
        },
        onError: (err) => {
          options.onDripToPrivateError?.(err);
        },
      }
    );
  };

  const dripToPublic = async ({ amount, feePaymentMethod }: DripParams) => {
    if (!dripperAddress || !tokenAddress || !account) {
      options.onDripToPublicError?.(
        new Error('Contract addresses not configured')
      );
      return;
    }

    return writePublicAsync(
      {
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_public',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      },
      {
        onSuccess: () => {
          invalidateAllBalances();
          options.onDripToPublicSuccess?.();
        },
        onError: (err) => {
          options.onDripToPublicError?.(err);
        },
      }
    );
  };

  return {
    dripToPrivate,
    dripToPublic,
    isPrivatePending,
    isPublicPending,
    isReady,
  };
};
