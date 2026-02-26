import { useQuery } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import {
  useAztecWallet,
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '../../aztec-wallet';
import { getContractMethod } from './utils';
import type { SimulateViewsOp } from '../../types';
import type {
  ReadContractsContract,
  ReadContractResult,
  UseReadContractsParams,
  UseReadContractsReturn,
} from '../../types/contractTypes';
import type { WalletConnector } from '../../types/walletConnector';

/**
 * Parse the raw result from a browser wallet batch simulation.
 * The result may be `{ decoded: unknown[] }` or a direct array.
 */
const parseBatchResult = (raw: unknown, expectedLength: number): unknown[] => {
  if (Array.isArray(raw)) return raw;

  const obj = raw as Record<string, unknown> | null | undefined;
  if (obj && 'decoded' in obj && Array.isArray(obj.decoded)) {
    return obj.decoded;
  }

  // Single-call result wrapped — return as single-element array
  if (expectedLength === 1) return [raw];

  throw new Error(
    `Unexpected batch result shape: expected array of ${expectedLength} results`
  );
};

/**
 * Execute a batch of contract reads via browser wallet (single round-trip).
 */
const executeBrowserWalletBatch = async (
  connector: WalletConnector,
  contracts: ReadContractsContract[],
  allowFailure: boolean
): Promise<ReadContractResult[] | unknown[]> => {
  if (!isBrowserWalletConnector(connector)) {
    throw new Error('Expected browser wallet connector');
  }

  const selectedAccount = connector.getCaipAccount();
  if (!selectedAccount) {
    throw new Error('Browser wallet account not selected');
  }

  const operation: SimulateViewsOp = {
    kind: 'simulate_views',
    account: selectedAccount,
    calls: contracts.map((c) => ({
      kind: 'call' as const,
      contract: c.address,
      method: String(c.functionName),
      args: c.args as unknown[],
    })),
  };

  const result = await connector.executeOperation(operation);

  if (result.status !== 'ok') {
    const errorMsg =
      'error' in result && result.error
        ? result.error
        : 'Batch simulation failed';

    if (allowFailure) {
      return contracts.map(() => ({
        status: 'failure' as const,
        error: new Error(errorMsg),
      }));
    }
    throw new Error(errorMsg);
  }

  const results = parseBatchResult(result.result, contracts.length);

  if (allowFailure) {
    return results.map((r) => ({
      status: 'success' as const,
      result: r,
    }));
  }

  return results;
};

/**
 * Execute a batch of contract reads via app-managed PXE (parallel simulate calls).
 */
const executeAppManagedBatch = async (
  connector: WalletConnector,
  contracts: ReadContractsContract[],
  allowFailure: boolean,
  fromAddress: string
): Promise<ReadContractResult[] | unknown[]> => {
  if (!hasAppManagedPXE(connector)) {
    throw new Error('Expected app-managed PXE connector');
  }

  const wallet = connector.getWallet();
  if (!wallet) {
    throw new Error('Wallet instance not available');
  }

  const from = AztecAddress.fromString(fromAddress);

  const promises = contracts.map(async (c) => {
    const contractAddress = AztecAddress.fromString(c.address);
    const contractInstance = Contract.at(
      contractAddress,
      c.contract.artifact,
      wallet
    );

    const method = getContractMethod(contractInstance, String(c.functionName));
    if (!method) {
      throw new Error(`Method ${String(c.functionName)} not found on contract`);
    }

    return method(...(c.args as unknown[])).simulate({ from });
  });

  if (allowFailure) {
    const settled = await Promise.allSettled(promises);
    return settled.map(
      (s): ReadContractResult =>
        s.status === 'fulfilled'
          ? { status: 'success', result: s.value }
          : { status: 'failure', error: s.reason as Error }
    );
  }

  return Promise.all(promises);
};

/**
 * Declarative hook for batching multiple Aztec contract reads into a single query.
 *
 * Mirrors wagmi's `useReadContracts` API: pass an array of contract read configs
 * and the hook batches them into a single `useQuery`, providing one cache entry,
 * one loading state, and atomic refetches.
 *
 * - **Browser wallet**: builds a single `SimulateViewsOp` with multiple calls (one round-trip).
 * - **App-managed PXE**: executes reads in parallel via `Promise.allSettled` / `Promise.all`.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useReadContracts({
 *   queryKey: ['tokenBalance', tokenAddress, ownerAddress],
 *   contracts: [
 *     { contract: TokenContract, address: tokenAddress, functionName: 'balance_of_private', args: [owner] },
 *     { contract: TokenContract, address: tokenAddress, functionName: 'balance_of_public', args: [owner] },
 *   ],
 *   allowFailure: false,
 * });
 * ```
 */
export const useReadContracts = <
  TAllowFailure extends boolean = true,
  TSelectData = TAllowFailure extends true ? ReadContractResult[] : unknown[],
>(
  params: UseReadContractsParams<TAllowFailure, TSelectData>
): UseReadContractsReturn<TSelectData> => {
  const { isConnected, connector, account } = useAztecWallet();
  const allowFailure = (params.allowFailure ?? true) as TAllowFailure;

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
      params.contracts.length > 0
  );

  const queryKey = params.queryKey ?? [
    'readContracts',
    params.contracts.map((c) => [c.address, String(c.functionName), c.args]),
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!connector || !account) {
        throw new Error('Missing required parameters');
      }

      if (isBrowserWalletConnector(connector)) {
        return executeBrowserWalletBatch(
          connector,
          params.contracts,
          allowFailure as boolean
        );
      }

      if (hasAppManagedPXE(connector)) {
        return executeAppManagedBatch(
          connector,
          params.contracts,
          allowFailure as boolean,
          account.getAddress().toString()
        );
      }

      throw new Error('Unknown wallet type');
    },
    enabled: isEnabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
    select: select as
      | ((data: ReadContractResult[] | unknown[]) => TSelectData)
      | undefined,
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
