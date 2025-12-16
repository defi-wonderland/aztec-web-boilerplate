import { useMemo } from 'react';
import { useContractRegistration } from '../context/useContractRegistration';
import type {
  ContractConfigMap,
  ContractStatus,
} from '../../contract-registry';

type ContractStatusMap<T extends readonly string[]> = {
  [K in T[number]]: ContractStatus;
};

interface UseRequiredContractsReturn<T extends readonly string[]> {
  /** Are all required contracts ready? */
  isReady: boolean;
  /** Are any contracts still loading? */
  isLoading: boolean;
  /** Did any contract fail to register? */
  hasError: boolean;
  /** List of contracts that failed to register */
  failedContracts: T[number][];
  /** List of contracts still loading */
  pendingContracts: T[number][];
  /** Individual status per contract */
  statuses: ContractStatusMap<T>;
}

interface ContractResult {
  name: string;
  status: ContractStatus;
  error: Error | null;
}

/**
 * Hook to ensure multiple contracts are registered before use.
 * Automatically triggers registration for any unregistered contracts.
 *
 * @param contractNames - Array of contract names to register
 * @returns Object with loading state, errors, and individual statuses
 *
 * @example
 * ```tsx
 * const { isReady, isLoading, failedContracts, pendingContracts } = useRequiredContracts(['dripper', 'token'] as const);
 *
 * if (isLoading) {
 *   return <Spinner message={`Loading: ${pendingContracts.join(', ')}`} />;
 * }
 *
 * if (failedContracts.length > 0) {
 *   return <Error message={`Failed to register: ${failedContracts.join(', ')}`} />;
 * }
 *
 * // Safe to use contracts now - isReady is true
 * ```
 */
export function useRequiredContracts<
  T extends readonly string[],
  TConfig extends ContractConfigMap = ContractConfigMap,
>(contractNames: T): UseRequiredContractsReturn<T> {
  // Get registration status for each contract
  // Note: hooks are called unconditionally in the same order each render
  const contract0 = useContractRegistration<TConfig>(contractNames[0] ?? '');
  const contract1 = useContractRegistration<TConfig>(contractNames[1] ?? '');
  const contract2 = useContractRegistration<TConfig>(contractNames[2] ?? '');
  const contract3 = useContractRegistration<TConfig>(contractNames[3] ?? '');
  const contract4 = useContractRegistration<TConfig>(contractNames[4] ?? '');

  // Map results based on actual contract count
  const allResults = [contract0, contract1, contract2, contract3, contract4];

  return useMemo(() => {
    const results: ContractResult[] = contractNames.map((name, index) => ({
      name,
      status: allResults[index]?.status ?? 'idle',
      error: allResults[index]?.error ?? null,
    }));

    const statuses = Object.fromEntries(
      results.map((r) => [r.name, r.status])
    ) as ContractStatusMap<T>;

    const pendingContracts = results
      .filter((r) => r.status === 'idle' || r.status === 'registering')
      .map((r) => r.name) as T[number][];

    const failedContracts = results
      .filter((r) => r.status === 'error')
      .map((r) => r.name) as T[number][];

    const isReady = results.every((r) => r.status === 'ready');
    const isLoading = pendingContracts.length > 0;
    const hasError = failedContracts.length > 0;

    return {
      isReady,
      isLoading,
      hasError,
      failedContracts,
      pendingContracts,
      statuses,
    };
  }, [
    contractNames,
    allResults[0]?.status,
    allResults[1]?.status,
    allResults[2]?.status,
    allResults[3]?.status,
    allResults[4]?.status,
  ]);
}
