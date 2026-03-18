import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import {
  useAztecWallet,
  WalletType,
  hasAppManagedPXE,
} from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import {
  type ContractConfigMap,
  type ContractStatus,
  type UseContractReturn,
  type ContractName,
  type ContractType,
} from '../../contract-registry';
import {
  useContractRegistryStore,
  useContractRegistryStatus,
} from '../../store';
import { queuePxeCall } from '../../utils';
import { getNetworkDeployments } from '../../utils/deployments';

interface ExternalWalletContractProxy {
  readonly __browserWalletPlaceholder: true;
  readonly address: AztecAddress;
  readonly contractName: string;
}

/**
 * Hook for getting a callable contract instance by name.
 *
 * This hook handles:
 * 1. Contract registration with PXE (lazy loading if needed)
 * 2. Creating a callable contract instance using the wallet
 * 3. Status tracking and error handling
 *
 * Contract type is automatically inferred from the contract name when
 * the config entry includes a `contract` class.
 *
 * @example
 * ```typescript
 * const { contract, isReady } = useContract('dripper');
 *
 * if (isReady) {
 *   // contract is typed as DripperContract
 *   await contract.methods.drip_to_public(amount).send();
 * }
 * ```
 */
export function useContract<K extends ContractName>(
  name: K
): UseContractReturn<ContractType<K>> {
  type TContract = ContractType<K>;
  const registry = useContractRegistryStore((state) => state.registry);
  const artifacts = useContractRegistryStore((state) => state.artifacts);
  const registryStatus = useContractRegistryStatus();
  const { connector, account, currentConfig, walletType } = useAztecWallet();

  const isBrowserWallet = walletType === WalletType.BROWSER_WALLET;

  const wallet = hasAppManagedPXE(connector) ? connector.getWallet() : null;

  const [contract, setContract] = useState<TContract | null>(null);
  const [status, setStatus] = useState<ContractStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const getContractDefinition = useCallback(() => {
    return (
      (contractsConfig as ContractConfigMap)[
        name as keyof typeof contractsConfig
      ] ?? null
    );
  }, [name]);

  /**
   * For external wallets, we create a proxy marker instead of a real contract instance.
   * The actual contract calls are routed through the wallet's execute API in hooks.
   */
  const createExternalWalletContractProxy = useCallback((): TContract => {
    const definition = getContractDefinition();

    if (!definition) {
      throw new Error(`Unknown contract: "${name}"`);
    }

    if (!account) {
      throw new Error('External wallet account not connected');
    }

    const network = currentConfig?.name;
    if (!network) {
      throw new Error('Network not configured');
    }
    const deployments = getNetworkDeployments(network);
    const deployment = deployments[name];
    if (!deployment?.address) {
      throw new Error(`No deployment for "${name}" on ${network}`);
    }
    const contractAddress = AztecAddress.fromString(deployment.address);

    const proxy: ExternalWalletContractProxy = {
      __browserWalletPlaceholder: true,
      address: contractAddress,
      contractName: String(name),
    };

    return proxy as unknown as TContract;
  }, [account, currentConfig, getContractDefinition, name]);

  const networkName = currentConfig?.name;

  // React-recommended pattern: reset state when dependencies change by
  // tracking previous values in state and calling setState during render.
  // This triggers a synchronous re-render before commit, preventing stale
  // contract references from being visible to consumers.
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevWallet, setPrevWallet] = useState(wallet);
  const [prevNetworkName, setPrevNetworkName] = useState(networkName);
  if (wallet !== prevWallet || networkName !== prevNetworkName) {
    setPrevWallet(wallet);
    setPrevNetworkName(networkName);
    setContract(null);
    setStatus('idle');
    setError(null);
  }

  const hasCreatedContract = useRef(false);

  useEffect(() => {
    if (!registry || isBrowserWallet) {
      return;
    }

    hasCreatedContract.current = false;

    const updateState = async () => {
      const currentStatus = registry.getStatus(name);
      setStatus(currentStatus);

      if (currentStatus === 'ready' && wallet && !hasCreatedContract.current) {
        const instance = registry.getInstance(name);
        const definition = getContractDefinition();

        const resolvedArtifact = artifacts?.[name as string];
        if (instance && definition && resolvedArtifact) {
          hasCreatedContract.current = true;
          try {
            const callableContract = await queuePxeCall(async () =>
              Contract.at(instance.address, resolvedArtifact, wallet)
            );
            console.log(
              `[useContract:${String(name)}] ✅ Callable contract created`
            );
            setContract(callableContract as TContract);
          } catch (err) {
            console.error(
              `[useContract:${String(name)}] ❌ Failed to create callable contract:`,
              err
            );
            hasCreatedContract.current = false;
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      } else if (currentStatus !== 'ready') {
        setContract(null);
      }
    };

    updateState();

    const unsubscribe = registry.subscribe(updateState);
    return unsubscribe;
  }, [
    registry,
    name,
    wallet,
    isBrowserWallet,
    getContractDefinition,
    artifacts,
    networkName,
  ]);

  useEffect(() => {
    if (!registry || registryStatus !== 'ready' || isBrowserWallet) {
      return;
    }

    const currentStatus = registry.getStatus(name);

    if (currentStatus === 'idle') {
      registry.register(name).catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }, [registry, registryStatus, name, isBrowserWallet]);

  // Browser wallet: proxy is pure derived state — no async, no subscriptions.
  // useMemo keeps a stable reference and avoids storing derived values in useState.
  const browserWalletState = useMemo<{
    contract: TContract | null;
    status: ContractStatus;
    error: Error | null;
  } | null>(() => {
    if (!isBrowserWallet) return null;
    if (!account) return { contract: null, status: 'idle', error: null };
    try {
      const proxy = createExternalWalletContractProxy();
      return { contract: proxy, status: 'ready', error: null };
    } catch (err) {
      return {
        contract: null,
        status: 'error',
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }, [isBrowserWallet, account, createExternalWalletContractProxy]);

  const register = useCallback(async () => {
    if (isBrowserWallet) return;

    setError(null);

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
  }, [isBrowserWallet, name, registry]);

  const resolved = browserWalletState ?? { contract, status, error };
  const isReady = resolved.status === 'ready' && resolved.contract !== null;

  return useMemo(
    () => ({
      contract: resolved.contract,
      status: resolved.status,
      error: resolved.error,
      isReady,
      register,
    }),
    [resolved.contract, resolved.status, resolved.error, isReady, register]
  );
}
