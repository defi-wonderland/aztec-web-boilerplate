import { useQuery } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, type ContractBase } from '@aztec/aztec.js/contracts';
import {
  useAztecWallet,
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '../../aztec-wallet';
import { getContractMethod } from './utils';
import type { SimulateViewsOp } from '../../types';
import type {
  MethodsOf,
  UseReadContractParams,
  UseReadContractReturn,
} from '../../types/contractTypes';

/**
 * Declarative hook for reading/simulating Aztec contract methods.
 *
 * Mirrors wagmi's `useReadContract` API: pass params declaratively and the
 * hook auto-fetches, caches, deduplicates, and refetches as needed.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useReadContract({
 *   queryKey: ['tokenBalance', tokenAddress, ownerAddress],
 *   contract: TokenContract,
 *   address: tokenAddress,
 *   functionName: 'balance_of_private',
 *   args: [ownerAddress],
 * });
 *
 * // Invalidation — just native TanStack Query
 * queryClient.invalidateQueries({ queryKey: ['tokenBalance', tokenAddress, ownerAddress] });
 * ```
 */
export const useReadContract = <
  TContract extends ContractBase,
  TMethod extends MethodsOf<TContract>,
  TSelectData = unknown,
>(
  params: UseReadContractParams<TContract, TMethod, TSelectData>
): UseReadContractReturn<TSelectData> => {
  const { isConnected, connector, account } = useAztecWallet();

  const {
    enabled: queryEnabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    select,
    retry,
  } = params.query ?? {};

  const isEnabled = Boolean(
    (queryEnabled ?? true) &&
      isConnected &&
      connector &&
      account &&
      params.address &&
      params.args !== undefined
  );

  const queryKey = params.queryKey ?? [
    'readContract',
    params.address,
    String(params.functionName),
    params.args,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // These are guaranteed non-null by `enabled` guard
      if (
        !connector ||
        !account ||
        !params.address ||
        params.args === undefined
      ) {
        throw new Error('Missing required parameters');
      }

      const artifact = params.contract.artifact;
      const address = params.address;
      const functionName = String(params.functionName);
      const args = params.args as unknown[];

      // ========== BROWSER WALLET FLOW ==========
      if (isBrowserWalletConnector(connector)) {
        const selectedAccount = connector.getCaipAccount();
        if (!selectedAccount) {
          throw new Error('Browser wallet account not selected');
        }

        const operation: SimulateViewsOp = {
          kind: 'simulate_views',
          account: selectedAccount,
          calls: [
            {
              kind: 'call',
              contract: address,
              method: functionName,
              args,
            },
          ],
        };

        const result = await connector.executeOperation(operation);

        if (result.status !== 'ok') {
          const errorMsg =
            'error' in result && result.error
              ? result.error
              : 'Simulation failed';
          throw new Error(errorMsg);
        }

        return result.result;
      }

      // ========== APP-MANAGED PXE FLOW (Embedded + External Signer) ==========
      if (hasAppManagedPXE(connector)) {
        const wallet = connector.getWallet();
        if (!wallet) {
          throw new Error('Wallet instance not available');
        }

        const contractAddress = AztecAddress.fromString(address);
        const contractInstance = Contract.at(contractAddress, artifact, wallet);

        const method = getContractMethod(contractInstance, functionName);
        if (!method) {
          throw new Error(`Method ${functionName} not found on contract`);
        }

        return await method(...args).simulate({
          from: account.getAddress(),
        });
      }

      throw new Error('Unknown wallet type');
    },
    enabled: isEnabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    select,
    retry,
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    isFetching: query.isFetching,
    status: query.status,
    refetch: async () => {
      await query.refetch();
    },
  };
};
