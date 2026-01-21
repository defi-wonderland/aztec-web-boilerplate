import { useMemo, useEffect, useSyncExternalStore } from 'react';
import { useAztecWallet, WalletType } from '../../aztec-wallet';
import { useContractRegistry } from '../context/useContractRegistry';
import type { ContractStatus, ContractName } from '../../contract-registry';

type ContractStatusMap<T extends readonly ContractName[]> = {
  [K in T[number]]: ContractStatus;
};

interface UseRequiredContractsReturn<T extends readonly ContractName[]> {
  isReady: boolean;
  isLoading: boolean;
  hasError: boolean;
  failedContracts: T[number][];
  pendingContracts: T[number][];
  statuses: ContractStatusMap<T>;
}

/**
 * Hook to check if multiple contracts are registered and ready.
 * Automatically triggers registration for unregistered contracts.
 *
 * This hook only checks STATUS - it does NOT return contract instances.
 * Use `useContractRegistration` to get callable contract instances.
 *
 * @example
 * ```tsx
 * const { isReady, isLoading, hasError } = useRequiredContracts(['dripper', 'token'] as const);
 *
 * if (isLoading) return <Spinner />;
 * if (hasError) return <Error />;
 * // Now safe to render UI that uses these contracts
 * ```
 */
export function useRequiredContracts<T extends readonly ContractName[]>(
  contractNames: T
): UseRequiredContractsReturn<T> {
  const { walletType, isConnected } = useAztecWallet();
  const isBrowserWallet = walletType === WalletType.BROWSER_WALLET;

  const {
    subscribe,
    registerMany,
    getStatus,
    status: registryStatus,
  } = useContractRegistry();

  // Get snapshot of current statuses (serialized for comparison)
  const getSnapshot = (): string => {
    const statuses = Object.fromEntries(
      contractNames.map((name) => [name, getStatus(name)])
    );
    return JSON.stringify(statuses);
  };

  // React will re-render when snapshot changes
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Trigger registration when registry is ready
  useEffect(() => {
    if (registryStatus !== 'ready' || contractNames.length === 0) {
      return;
    }

    registerMany([...contractNames]).catch((err) => {
      console.error('[useRequiredContracts] Registration failed:', err);
    });
  }, [contractNames, registerMany, registryStatus]);

  // Compute derived state
  return useMemo(() => {
    // For browser wallets, contracts are always "ready" since useContractRegistration
    // handles them with proxies - no PXE registration needed on app side
    if (isBrowserWallet && isConnected) {
      const statuses = contractNames.reduce((acc, name) => {
        acc[name as T[number]] = 'ready';
        return acc;
      }, {} as ContractStatusMap<T>);

      return {
        isReady: true,
        isLoading: false,
        hasError: false,
        failedContracts: [] as T[number][],
        pendingContracts: [] as T[number][],
        statuses,
      };
    }

    const statuses = contractNames.reduce((acc, name) => {
      acc[name as T[number]] = getStatus(name);
      return acc;
    }, {} as ContractStatusMap<T>);

    const pendingContracts = contractNames.filter((name) => {
      const status = statuses[name as T[number]];
      return status === 'idle' || status === 'registering';
    }) as T[number][];

    const failedContracts = contractNames.filter(
      (name) => statuses[name as T[number]] === 'error'
    ) as T[number][];

    return {
      isReady: contractNames.every(
        (name) => statuses[name as T[number]] === 'ready'
      ),
      isLoading: pendingContracts.length > 0,
      hasError: failedContracts.length > 0,
      failedContracts,
      pendingContracts,
      statuses,
    };
  }, [contractNames, getStatus, isBrowserWallet, isConnected]);
}
