import { useCallback, useMemo } from 'react';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import { useContractRegistryContext } from '../../providers/ContractRegistryContext';
import {
  useContractRegistryStatus,
  useContractRegistryError,
} from '../../store/contractRegistry';
import type {
  ContractConfigMap,
  ContractNames,
  ContractStatus,
  UseContractRegistryReturn,
} from '../../contract-registry';

/**
 * Hook for accessing the contract registry and its operations.
 *
 * Provides methods to check registration status, get instances,
 * and register contracts on-demand.
 *
 * @example
 * ```typescript
 * const {
 *   isRegistered,
 *   getInstance,
 *   register,
 *   registerMany,
 *   status,
 * } = useContractRegistry<typeof contractsConfig>();
 *
 * // Check if a contract is ready
 * if (isRegistered('dripper')) {
 *   const instance = getInstance('dripper');
 * }
 *
 * // Register on demand
 * await register('token');
 *
 * // Bulk register
 * await registerMany(['dripper', 'token']);
 * ```
 */
export function useContractRegistry<
  T extends ContractConfigMap = ContractConfigMap,
>(): UseContractRegistryReturn<T> {
  const { registry } = useContractRegistryContext<T>();
  const status = useContractRegistryStatus();
  const error = useContractRegistryError();

  const isRegistered = useCallback(
    (name: ContractNames<T>): boolean => {
      return registry?.isRegistered(name) ?? false;
    },
    [registry]
  );

  const getInstance = useCallback(
    (name: ContractNames<T>): ContractInstanceWithAddress | null => {
      return registry?.getInstance(name) ?? null;
    },
    [registry]
  );

  const getStatus = useCallback(
    (name: ContractNames<T>): ContractStatus => {
      return registry?.getStatus(name) ?? 'idle';
    },
    [registry]
  );

  const register = useCallback(
    async (name: ContractNames<T>): Promise<void> => {
      if (!registry) {
        throw new Error('Contract registry not initialized');
      }
      return registry.register(name);
    },
    [registry]
  );

  const registerMany = useCallback(
    async (names: ContractNames<T>[]): Promise<void> => {
      if (!registry) {
        throw new Error('Contract registry not initialized');
      }
      return registry.registerAll(names);
    },
    [registry]
  );

  const getRegisteredNames = useCallback((): ContractNames<T>[] => {
    return registry?.getRegisteredNames() ?? [];
  }, [registry]);

  return useMemo(
    () => ({
      isRegistered,
      getInstance,
      getStatus,
      register,
      registerMany,
      getRegisteredNames,
      status,
      error,
    }),
    [
      isRegistered,
      getInstance,
      getStatus,
      register,
      registerMany,
      getRegisteredNames,
      status,
      error,
    ]
  );
}
