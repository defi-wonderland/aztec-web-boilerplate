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
  const { writeContractAsync, isPending, isError, error, reset } =
    useWriteContract();
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

  const dripToPrivate = async ({ amount, feePaymentMethod }: DripParams) => {
    if (!dripperAddress || !tokenAddress) {
      throw new Error('Contract addresses not configured');
    }
    if (!account) {
      throw new Error('Account not available');
    }

    try {
      await writeContractAsync({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_private',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      });

      invalidateAllBalances();
      options.onDripToPrivateSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options.onDripToPrivateError?.(error);
    }
  };

  const dripToPublic = async ({ amount, feePaymentMethod }: DripParams) => {
    if (!dripperAddress || !tokenAddress) {
      throw new Error('Contract addresses not configured');
    }
    if (!account) {
      throw new Error('Account not available');
    }

    try {
      await writeContractAsync({
        contract: DripperContract,
        address: dripperAddress,
        functionName: 'drip_to_public',
        args: [AztecAddress.fromString(tokenAddress), amount],
        feePaymentMethod,
      });

      invalidateAllBalances();
      options.onDripToPublicSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options.onDripToPublicError?.(error);
    }
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
