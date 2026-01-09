import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import { TimingToast } from '../components';
import { contractsConfig } from '../config/contracts';
import { getNetworkArtifacts } from '../config/networkArtifacts';
import {
  ContractRegistry,
  getContractsForConfig,
  type ContractConfigMap,
  type ContractNames,
} from '../contract-registry';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import {
  useContractRegistryStore,
  useContractRegistryStatus,
  useContractRegistryTimingInfo,
} from '../store/contractRegistry';
import { hasAppManagedPXE } from '../types/walletConnector';
import {
  ContractRegistryContext,
  type ContractContextValue,
} from './ContractRegistryContext';
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

interface EmbeddedContractProviderProps {
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

export function EmbeddedContractProvider<
  T extends ContractConfigMap = ContractConfigMap,
>({
  showTimingToast = true,
  children,
}: EmbeddedContractProviderProps): React.ReactElement {
  const { currentConfig, isConnected, isInitialized, connector } =
    useUniversalWallet();

  // Get PXE from the active connector (embedded or external signer)
  const pxe = hasAppManagedPXE(connector) ? connector.getPXE() : null;

  // Only register contracts when wallet is connected and PXE is ready
  const isReady = isConnected && isInitialized && pxe !== null;

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

  const { setStatus, setError, setTimingInfo } = useContractRegistryStore();
  const status = useContractRegistryStatus();
  const timingInfo = useContractRegistryTimingInfo();

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

        const allCached = await checkContractsCached(
          pxe,
          initialContracts,
          currentConfig
        );
        const start = performance.now();
        await registry.registerAll(initialContracts);
        const elapsedMs = performance.now() - start;

        if (showTimingToast) {
          setTimingInfo({
            elapsedMs,
            contractCount: initialContracts.length,
            fromCache: allCached,
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
    contracts,
    currentConfig,
    initialContracts,
    isReady,
    pxe,
    showTimingToast,
    checkContractsCached,
    setStatus,
    setError,
    setTimingInfo,
  ]);

  const contextValue = useMemo(
    () => ({
      registry: registryRef.current,
    }),
    // Re-compute when status changes to get updated registryRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status]
  );

  if (!isReady) {
    return <>{children}</>;
  }

  return (
    <ContractRegistryContext.Provider
      value={contextValue as ContractContextValue}
    >
      {children}
      {showTimingToast && timingInfo && status === 'ready' && (
        <TimingToast
          elapsedMs={timingInfo.elapsedMs}
          contractCount={timingInfo.contractCount}
          fromCache={timingInfo.fromCache}
          onClose={() => setTimingInfo(null)}
        />
      )}
    </ContractRegistryContext.Provider>
  );
}
