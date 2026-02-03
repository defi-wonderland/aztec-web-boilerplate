import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Zap, RefreshCw } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import { contractsConfig } from '../config/contracts';
import { getNetworkArtifacts } from '../config/networkArtifacts';
import {
  ContractRegistry,
  getContractsForConfig,
  type ContractConfigMap,
  type ContractNames,
} from '../contract-registry';
import { useToast } from '../hooks';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import type { NetworkConfig } from '../config/networks';

/**
 * Get contracts to load at initialization (lazyRegister !== true)
 */
const getInitialContracts = <T extends ContractConfigMap>(
  contracts: T
): ContractNames<T>[] => {
  return (Object.entries(contracts) as [ContractNames<T>, T[keyof T]][])
    .filter(([, config]) => !config.lazyRegister)
    .map(([name]) => name);
};

interface ContractRegistryInitializerProps {
  showTimingToast?: boolean;
  children: ReactNode;
}

const createRegistry = <T extends ContractConfigMap>(
  pxe: PXE,
  contracts: T,
  config: NetworkConfig
) => {
  return new ContractRegistry(pxe, contracts, config);
};

export function ContractRegistryInitializer<
  T extends ContractConfigMap = ContractConfigMap,
>({
  showTimingToast = true,
  children,
}: ContractRegistryInitializerProps): React.ReactElement {
  const { connector, isPXEInitialized, isConnected, currentConfig } =
    useAztecWallet();
  const { addToast } = useToast();

  // Get PXE from the active connector (embedded or external signer)
  const pxe = hasAppManagedPXE(connector) ? connector.getPXE() : null;

  // Only register contracts when wallet is connected and PXE is ready
  const isReady = isConnected && isPXEInitialized && pxe !== null;

  const contracts = useMemo(
    () =>
      getContractsForConfig(
        contractsConfig,
        getNetworkArtifacts(currentConfig.name)
      ) as unknown as T,
    [currentConfig]
  );

  const initialContracts = useMemo(
    () => getInitialContracts(contracts),
    [contracts]
  );

  const { setStatus, setError, setRegistry } = useContractRegistryStore();

  const registryRef = useRef<ContractRegistry<T> | null>(null);
  const initializingRef = useRef(false);

  const checkContractsCached = useMemo(
    () =>
      async (
        pxeInstance: PXE,
        contractsList: ContractNames<T>[],
        networkConfig: NetworkConfig
      ): Promise<boolean> => {
        if (contractsList.length === 0) return true;
        const results = await Promise.all(
          contractsList.map(async (name) => {
            const contractConfig = contracts[name];
            if (!contractConfig) return false;
            const expectedAddress = AztecAddress.fromString(
              contractConfig.address(networkConfig)
            );
            const existing =
              await pxeInstance.getContractInstance(expectedAddress);
            return Boolean(existing);
          })
        );
        return results.every(Boolean);
      },
    [contracts]
  );

  useEffect(() => {
    if (!isReady || initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const initializeRegistry = async () => {
      try {
        const registry = createRegistry(pxe, contracts, currentConfig);
        registryRef.current = registry;
        setRegistry(registry);

        const allCached = await checkContractsCached(
          pxe,
          initialContracts,
          currentConfig
        );
        const start = performance.now();
        await registry.registerAll(initialContracts);
        const elapsedMs = performance.now() - start;

        if (showTimingToast && initialContracts.length > 0) {
          const labelSuffix = initialContracts.length === 1 ? '' : 's';
          const sourceText = allCached ? 'Cached in PXE' : 'Fresh registration';
          const icon = allCached ? (
            <Zap size={iconSize('md')} />
          ) : (
            <RefreshCw size={iconSize('md')} />
          );

          addToast({
            title: `Contracts loaded in ${elapsedMs.toFixed(0)}ms`,
            description: `${initialContracts.length} contract${labelSuffix} • ${sourceText}`,
            variant: 'info',
            icon,
            duration: 8000,
          });
        }

        setStatus('ready');
        setError(undefined);
      } catch (err) {
        const registrationError =
          err instanceof Error ? err : new Error(String(err));
        setError(registrationError);
        setStatus('error');
        console.error('Contract registration failed:', registrationError);
      } finally {
        initializingRef.current = false;
      }
    };

    initializeRegistry();
  }, [
    addToast,
    contracts,
    currentConfig,
    initialContracts,
    isReady,
    pxe,
    showTimingToast,
    checkContractsCached,
    setStatus,
    setError,
    setRegistry,
  ]);

  return <>{children}</>;
}
