import { useState, useEffect, useCallback, useMemo } from 'react';
import { useContractRegistryContext } from '../../providers/AztecContractProvider';
import { useAztecWallet } from './useAztecWallet';
import type {
  ContractConfigMap,
  ContractNames,
  ContractStatus,
  UseContractReturn,
} from '../../contract-registry';

/**
 * Hook for registering a contract with PXE and getting a callable contract instance.
 *
 * This hook handles:
 * 1. Contract registration with PXE (lazy loading)
 * 2. Creating a callable contract instance using the wallet
 * 3. Status tracking and error handling
 *
 * @example
 * ```typescript
 * // Get a callable contract instance
 * const { contract, status, isReady, error, register } = useContractRegistration('dripper');
 *
 * // Check if ready
 * if (!isReady) {
 *   return <Loading status={status} />;
 * }
 *
 * if (error) {
 *   return <Error message={error.message} onRetry={register} />;
 * }
 *
 * // Use the contract directly
 * await contract.methods.drip_to_public(recipient).send({ from: wallet.getAddress() });
 * ```
 */
export function useContractRegistration<
  T extends ContractConfigMap = ContractConfigMap,
  TContract = unknown
>(name: ContractNames<T>): UseContractReturn<TContract> {
  const { registry, status: registryStatus } = useContractRegistryContext<T>();
  const { wallet } = useAztecWallet();

  const [contract, setContract] = useState<TContract | null>(null);
  const [status, setStatus] = useState<ContractStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to registry changes and create callable contract
  useEffect(() => {
    if (!registry) {
      return;
    }

    const updateState = async () => {
      const currentStatus = registry.getStatus(name);
      setStatus(currentStatus);

      // If ready and we have a wallet, create the callable contract
      if (currentStatus === 'ready' && wallet) {
        const instance = registry.getInstance(name);
        const contractClass = registry.getContractClass(name);

        if (instance && contractClass) {
          try {
            const callableContract = await contractClass.at(
              instance.address,
              wallet
            );
            setContract(callableContract as TContract);
          } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      } else if (currentStatus !== 'ready') {
        setContract(null);
      }
    };

    // Initial state
    updateState();

    // Subscribe to changes
    const unsubscribe = registry.subscribe(updateState);
    return unsubscribe;
  }, [registry, name, wallet]);

  // Auto-register if not registered (lazy loading)
  useEffect(() => {
    if (!registry || registryStatus !== 'ready') {
      return;
    }

    const currentStatus = registry.getStatus(name);

    // Only trigger registration if idle (not yet attempted)
    if (currentStatus === 'idle') {
      registry.register(name).catch((err) => {
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
      await registry.register(name);
    } catch (err) {
      const registrationError =
        err instanceof Error ? err : new Error(String(err));
      setError(registrationError);
      throw registrationError;
    }
  }, [registry, name]);

  const isReady = status === 'ready' && contract !== null;

  return useMemo(
    () => ({
      contract,
      status,
      error,
      isReady,
      register,
    }),
    [contract, status, error, isReady, register]
  );
}
