import { useState, useEffect, useCallback, useMemo } from 'react';
import { useContractRegistryContext } from '../../providers/AztecContractProvider';
import type {
  ContractConfigMap,
  ContractNames,
  ContractStatus,
  UseContractReturn,
} from '../../contracts';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js';

/**
 * Hook for accessing a specific contract from the registry.
 *
 * Automatically triggers registration if the contract is not yet registered
 * (lazy loading). For eagerly loaded contracts, returns immediately.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { instance, status, error } = useContract<typeof aztecContracts>('dripper');
 *
 * if (status === 'ready' && instance) {
 *   // Use the contract
 *   const contract = DripperContract.at(instance.address, wallet);
 * }
 *
 * // With loading state
 * const { instance, status, error, register } = useContract('dripper');
 *
 * if (status === 'checking' || status === 'registering') {
 *   return <Loading />;
 * }
 *
 * if (status === 'error') {
 *   return <Error message={error?.message} onRetry={register} />;
 * }
 * ```
 */
export function useContract<T extends ContractConfigMap = ContractConfigMap>(
  name: ContractNames<T>
): UseContractReturn {
  const { registry, status: registryStatus } = useContractRegistryContext<T>();
  
  const [instance, setInstance] = useState<ContractInstanceWithAddress | null>(null);
  const [status, setStatus] = useState<ContractStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to registry changes
  useEffect(() => {
    if (!registry) {
      return;
    }

    const updateState = () => {
      setInstance(registry.getInstance(name));
      setStatus(registry.getStatus(name));
    };

    // Initial state
    updateState();

    // Subscribe to changes
    const unsubscribe = registry.subscribe(updateState);
    return unsubscribe;
  }, [registry, name]);

  // Auto-register if not registered (lazy loading)
  useEffect(() => {
    if (!registry || registryStatus !== 'ready') {
      return;
    }

    const currentStatus = registry.getStatus(name);
    
    // Only trigger registration if idle (not yet attempted)
    if (currentStatus === 'idle') {
      registry.ensureRegistered(name).catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }, [registry, registryStatus, name]);

  // Manual register function (for retries)
  const register = useCallback(async () => {
    if (!registry) {
      throw new Error('Contract registry not initialized');
    }
    
    setError(null);
    try {
      await registry.ensureRegistered(name);
    } catch (err) {
      const registrationError = err instanceof Error ? err : new Error(String(err));
      setError(registrationError);
      throw registrationError;
    }
  }, [registry, name]);

  return useMemo(
    () => ({
      instance,
      status,
      error,
      register,
    }),
    [instance, status, error, register]
  );
}


