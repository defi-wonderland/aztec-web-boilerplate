import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { DripperContract } from '../../artifacts/Dripper';
import { contractsConfig } from '../../config/contracts';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useWriteContract } from '../contracts/useWriteContract';
import { queryKeys } from '../queries/queryKeys';

interface DripParams {
  amount: bigint;
}

interface UseDripperOptions {
  onDripToPrivateSuccess?: () => void;
  onDripToPrivateError?: (error: Error) => void;
  onDripToPublicSuccess?: () => void;
  onDripToPublicError?: (error: Error) => void;
}

export const useDripper = (options: UseDripperOptions = {}) => {
  const { account, currentConfig } = useUniversalWallet();
  const { writeContract } = useWriteContract();
  const queryClient = useQueryClient();

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

      invalidateBalance();
    },
    onSuccess: () => options.onDripToPrivateSuccess?.(),
    onError: (error: Error) => options.onDripToPrivateError?.(error),
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

      invalidateBalance();
    },
    onSuccess: () => options.onDripToPublicSuccess?.(),
    onError: (error: Error) => options.onDripToPublicError?.(error),
  });

  return {
    dripToPrivate,
    dripToPublic,
    isReady,
  };
};
