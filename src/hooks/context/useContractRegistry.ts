import { useCallback, useMemo } from 'react';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import {
  useContractRegistryStatus,
  useContractRegistryError,
  useContractRegistryStore,
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
 * } = useContractRegistry();
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
export function useContractRegistry(): UseContractRegistryReturn<ContractConfigMap> {
  const registry = useContractRegistryStore((state) => state.registry);
  const status = useContractRegistryStatus();
  const error = useContractRegistryError();

  const isRegistered = useCallback(
    (name: ContractNames<ContractConfigMap>): boolean => {
      return registry?.isRegistered(name) ?? false;
    },
    [registry]
  );

  const getInstance = useCallback(
    (
      name: ContractNames<ContractConfigMap>
    ): ContractInstanceWithAddress | null => {
      return registry?.getInstance(name) ?? null;
    },
    [registry]
  );

  const getStatus = useCallback(
    (name: ContractNames<ContractConfigMap>): ContractStatus => {
      return registry?.getStatus(name) ?? 'idle';
    },
    [registry]
  );

  const register = useCallback(
    async (name: ContractNames<ContractConfigMap>): Promise<void> => {
      if (!registry) {
        throw new Error('Contract registry not initialized');
      }
      return registry.register(name);
    },
    [registry]
  );

  const registerMany = useCallback(
    async (names: ContractNames<ContractConfigMap>[]): Promise<void> => {
      if (!registry) {
        throw new Error('Contract registry not initialized');
      }
      return registry.registerAll(names);
    },
    [registry]
  );

  const getRegisteredNames =
    useCallback((): ContractNames<ContractConfigMap>[] => {
      return registry?.getRegisteredNames() ?? [];
    }, [registry]);

  const subscribe = useCallback(
    (callback: () => void): (() => void) => {
      if (!registry) return () => {};
      return registry.subscribe(callback);
    },
    [registry]
  );

  return useMemo(
    () => ({
      isRegistered,
      getInstance,
      getStatus,
      register,
      registerMany,
      getRegisteredNames,
      subscribe,
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
      subscribe,
      status,
      error,
    ]
  );
}
