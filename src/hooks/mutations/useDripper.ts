import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SendTransactionOperation } from '@azguardwallet/types';
import { useContractRegistration } from '../context/useContractRegistration';
import { useUniversalWallet } from '../context/useUniversalWallet';
import { useConfig } from '../context/useConfig';
import { queryKeys } from '../queries/queryKeys';
import type { ContractConfigMap } from '../../contract-registry';
import type { DripperContract } from '../../artifacts/Dripper';
import type { TokenContract } from '../../artifacts/Token';
import { WalletType } from '../../types/aztec';
import { aztecContracts } from '../../config/contracts';

interface DripParams {
  amount: bigint;
}

/**
 * Check if a contract is an Azguard proxy marker
 */
const isAzguardProxy = (contract: unknown): boolean => {
  return (
    typeof contract === 'object' &&
    contract !== null &&
    '__azguardProxy' in contract &&
    (contract as { __azguardProxy: boolean }).__azguardProxy === true
  );
};

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

  const { account, walletType, getSponsoredFeePaymentMethod, azguard } = useUniversalWallet();
  const { currentConfig } = useConfig();
  const queryClient = useQueryClient();
  
  const isAzguardWallet = walletType === WalletType.AZGUARD;
  const shouldUseSponsoredFees = walletType === WalletType.EMBEDDED;

  const isReady = isDripperReady && isTokenReady && !!account;

  const invalidateBalances = () => {
    const ownerAddress = account?.getAddress().toString();
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
      if (!account) {
        throw new Error('Account not available');
      }

      if (isAzguardWallet && isAzguardProxy(dripper) && isAzguardProxy(token)) {
        if (!azguard.state.selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const dripperAddress = aztecContracts.dripper.address(currentConfig);
        const tokenAddress = aztecContracts.token.address(currentConfig);

        const operation: SendTransactionOperation = {
          kind: 'send_transaction',
          account: azguard.state.selectedAccount,
          actions: [
            {
              kind: 'call',
              contract: dripperAddress,
              method: 'drip_to_private',
              args: [tokenAddress, amount.toString()],
            },
          ],
        };

        const results = await azguard.executeOperations([operation]);
        const result = results[0];
        
        if (result.status !== 'ok') {
          const errorMessage = 'error' in result ? result.error : 'Transaction failed';
          throw new Error(errorMessage || 'drip_to_private failed');
        }

        return;
      }

      const fromAddress = account.getAddress();
      const sendOptions: {
        from: ReturnType<typeof account.getAddress>;
        fee?: { paymentMethod: Awaited<ReturnType<typeof getSponsoredFeePaymentMethod>> };
      } = { from: fromAddress };

      if (shouldUseSponsoredFees) {
        const paymentMethod = await getSponsoredFeePaymentMethod();
        sendOptions.fee = { paymentMethod };
      }

      await (dripper as DripperContract).methods
        .drip_to_private((token as TokenContract).address, amount)
        .send(sendOptions)
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
      if (!account) {
        throw new Error('Account not available');
      }

      if (isAzguardWallet && isAzguardProxy(dripper) && isAzguardProxy(token)) {
        if (!azguard.state.selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const dripperAddress = aztecContracts.dripper.address(currentConfig);
        const tokenAddress = aztecContracts.token.address(currentConfig);

        const operation: SendTransactionOperation = {
          kind: 'send_transaction',
          account: azguard.state.selectedAccount,
          actions: [
            {
              kind: 'call',
              contract: dripperAddress,
              method: 'drip_to_public',
              args: [tokenAddress, amount.toString()],
            },
          ],
        };

        const results = await azguard.executeOperations([operation]);
        const result = results[0];
        
        if (result.status !== 'ok') {
          const errorMessage = 'error' in result ? result.error : 'Transaction failed';
          throw new Error(errorMessage || 'drip_to_public failed');
        }

        return;
      }

      const fromAddress = account.getAddress();
      const sendOptions: {
        from: ReturnType<typeof account.getAddress>;
        fee?: { paymentMethod: Awaited<ReturnType<typeof getSponsoredFeePaymentMethod>> };
      } = { from: fromAddress };

      if (shouldUseSponsoredFees) {
        const paymentMethod = await getSponsoredFeePaymentMethod();
        sendOptions.fee = { paymentMethod };
      }

      await (dripper as DripperContract).methods
        .drip_to_public((token as TokenContract).address, amount)
        .send(sendOptions)
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
      if (!account) {
        throw new Error('Account not available');
      }

      if (isAzguardWallet && isAzguardProxy(dripper)) {
        if (!azguard.state.selectedAccount) {
          throw new Error('Azguard account not selected');
        }

        const dripperAddress = aztecContracts.dripper.address(currentConfig);

        const operation: SendTransactionOperation = {
          kind: 'send_transaction',
          account: azguard.state.selectedAccount,
          actions: [
            {
              kind: 'call',
              contract: dripperAddress,
              method: 'sync_private_state',
              args: [],
            },
          ],
        };

        const results = await azguard.executeOperations([operation]);
        const result = results[0];
        
        if (result.status !== 'ok') {
          const errorMessage = 'error' in result ? result.error : 'Transaction failed';
          throw new Error(errorMessage || 'sync_private_state failed');
        }

        return;
      }

      const fromAddress = account.getAddress();
      const sendOptions: {
        from: ReturnType<typeof account.getAddress>;
        fee?: { paymentMethod: Awaited<ReturnType<typeof getSponsoredFeePaymentMethod>> };
      } = { from: fromAddress };

      if (shouldUseSponsoredFees) {
        const paymentMethod = await getSponsoredFeePaymentMethod();
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
