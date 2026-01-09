import { useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useContractRegistryContext } from '../../providers/ContractRegistryContext';
import type {
  ContractStatus,
  ContractName,
  ContractsConfig,
} from '../../contract-registry';

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
  const { registry, status: registryStatus } =
    useContractRegistryContext<ContractsConfig>();

  // Subscribe to registry changes
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!registry) return () => {};
      return registry.subscribe(onStoreChange);
    },
    [registry]
  );

  // Get snapshot of current statuses (serialized for comparison)
  const getSnapshot = useCallback(() => {
    if (!registry) return '';
    return contractNames.map((name) => registry.getStatus(name)).join(',');
  }, [registry, contractNames]);

  // React will re-render when snapshot changes
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Trigger registration when registry is ready
  useEffect(() => {
    if (registryStatus !== 'ready' || !registry || contractNames.length === 0) {
      return;
    }

    registry.registerAll([...contractNames]).catch((err) => {
      console.error('[useRequiredContracts] Registration failed:', err);
    });
  }, [contractNames, registry, registryStatus]);

  // Compute derived state
  return useMemo(() => {
    const statuses = contractNames.reduce((acc, name) => {
      acc[name as T[number]] = registry?.getStatus(name) ?? 'idle';
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
  }, [contractNames, registry]);
}
