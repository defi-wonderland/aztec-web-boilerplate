import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { useContractRegistryContext } from '../../providers/AztecContractProvider';
import { useUniversalWallet } from './useUniversalWallet';
import { useConfig } from './useConfig';
import { aztecContracts, getContractsForConfig } from '../../config/contracts';
import { WalletType } from '../../types/aztec';
import { queuePxeCall } from '../../utils';
import type {
  ContractConfigMap,
  ContractNames,
  ContractStatus,
  UseContractReturn,
} from '../../contract-registry';

/**
 * Marker type for Azguard-backed contracts.
 * These contracts don't use local instantiation - all calls go through Azguard's execute API.
 */
interface AzguardContractProxy {
  readonly __azguardProxy: true;
  readonly address: AztecAddress;
  readonly contractName: string;
}

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
  const { connector, walletType, account } = useUniversalWallet();
  const wallet = connector?.getWallet?.() ?? null;
  const { currentConfig } = useConfig();

  const isAzguardWallet = walletType === WalletType.AZGUARD;

  const [contract, setContract] = useState<TContract | null>(null);
  const [status, setStatus] = useState<ContractStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const getContractDefinition = useCallback(() => {
    const contracts = getContractsForConfig(currentConfig);
    return (
      (contracts as ContractConfigMap)[name as keyof typeof aztecContracts] ??
      null
    );
  }, [currentConfig, name]);

  /**
   * For Azguard wallets, we create a proxy marker instead of a real contract instance.
   * The actual contract calls are routed through Azguard's execute API in useDripper/etc.
   */
  const createAzguardContractProxy = useCallback((): TContract => {
    const definition = getContractDefinition();

    if (!definition) {
      throw new Error(`Unknown contract: "${name}"`);
    }

    if (!account) {
      throw new Error('Azguard account not connected');
    }

    const contractAddress = AztecAddress.fromString(
      definition.address(currentConfig)
    );

    const proxy: AzguardContractProxy = {
      __azguardProxy: true,
      address: contractAddress,
      contractName: String(name),
    };

    return proxy as unknown as TContract;
  }, [account, currentConfig, getContractDefinition, name]);

  const hasCreatedContract = useRef(false);
  const currentWalletRef = useRef<Wallet | null>(null);

  useEffect(() => {
    if (wallet !== currentWalletRef.current) {
      hasCreatedContract.current = false;
      currentWalletRef.current = wallet;
    }
  }, [wallet]);

  // Subscribe to registry changes and create callable contract
  useEffect(() => {
    if (!registry || isAzguardWallet) {
      return;
    }

    const updateState = async () => {
      const currentStatus = registry.getStatus(name);
      setStatus(currentStatus);

      // If ready and we have a wallet, create the callable contract
      // Skip if we've already created one for this wallet
      console.log(`[useContractRegistration:${String(name)}] updateState:`, {
        currentStatus,
        hasWallet: !!wallet,
        hasCreatedContract: hasCreatedContract.current,
      });
      if (currentStatus === 'ready' && wallet && !hasCreatedContract.current) {
        const instance = registry.getInstance(name);
        const definition = getContractDefinition();
        console.log(`[useContractRegistration:${String(name)}] Creating callable contract:`, {
          hasInstance: !!instance,
          hasDefinition: !!definition,
        });

        if (instance && definition) {
          hasCreatedContract.current = true;
          try {
            // Use Contract.at() with the correct artifact from config
            // This ensures devnet uses devnet artifact, not the sandbox artifact
            // baked into the contract class
            const callableContract = await queuePxeCall(() =>
              Contract.at(instance.address, definition.artifact, wallet)
            );
            console.log(`[useContractRegistration:${String(name)}] ✅ Callable contract created`);
            setContract(callableContract as TContract);
          } catch (err) {
            console.error(`[useContractRegistration:${String(name)}] ❌ Failed to create callable contract:`, err);
            hasCreatedContract.current = false;
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
  }, [registry, name, wallet, isAzguardWallet]);

  // Auto-register if not registered (lazy loading)
  useEffect(() => {
    if (!registry || registryStatus !== 'ready' || isAzguardWallet) {
      return;
    }

    const currentStatus = registry.getStatus(name);

    // Only trigger registration if idle (not yet attempted)
    if (currentStatus === 'idle') {
      registry.register(name).catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }, [registry, registryStatus, name, isAzguardWallet]);

  useEffect(() => {
    if (!isAzguardWallet) {
      return;
    }

    if (!account) {
      setContract(null);
      setStatus('idle');
      return;
    }

    // For Azguard, we synchronously create a proxy marker
    // No async contract instantiation needed - calls go through Azguard execute
    try {
      setStatus('registering');
      const proxy = createAzguardContractProxy();
      setContract(proxy);
      setStatus('ready');
      setError(null);
    } catch (err) {
      const hydrationError =
        err instanceof Error ? err : new Error(String(err));
      setError(hydrationError);
      setStatus('error');
      setContract(null);
    }
  }, [account, createAzguardContractProxy, isAzguardWallet]);

  // Manual register function (for retries)
  const register = useCallback(async () => {
    setError(null);

    if (isAzguardWallet) {
      try {
        setStatus('registering');
        const proxy = createAzguardContractProxy();
        setContract(proxy);
        setStatus('ready');
      } catch (err) {
        const registrationError =
          err instanceof Error ? err : new Error(String(err));
        setError(registrationError);
        setStatus('error');
        throw registrationError;
      }
      return;
    }

    if (!registry) {
      throw new Error('Contract registry not initialized');
    }

    try {
      await registry.register(name);
    } catch (err) {
      const registrationError =
        err instanceof Error ? err : new Error(String(err));
      setError(registrationError);
      throw registrationError;
    }
  }, [createAzguardContractProxy, isAzguardWallet, name, registry]);

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
