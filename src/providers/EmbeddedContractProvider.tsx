import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import type { NetworkConfig } from '../config/networks';
import {
  ContractRegistry,
  getContractsForConfig,
  type ContractConfigMap,
  type ContractNames,
  type ContractRegistryContextValue,
} from '../contract-registry';
import { getArtifactOverrides } from '../artifacts/artifactOverrides';
import { contractsConfig } from '../config/contracts';
import { isEmbeddedConnector } from '../types/walletConnector';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { TimingToast } from '../components';

type ContractContextValue<T extends ContractConfigMap = ContractConfigMap> =
  ContractRegistryContextValue<T>;

const ContractRegistryContext = createContext<ContractContextValue | null>(
  null
);

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

interface EmbeddedContractProviderProps<
  T extends ContractConfigMap = ContractConfigMap,
> {
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
}: EmbeddedContractProviderProps<T>): React.ReactElement {
  const { connector, isInitialized, currentConfig } = useUniversalWallet();

  const embeddedConnector = isEmbeddedConnector(connector) ? connector : null;
  const pxe = embeddedConnector?.getPXE() ?? null;

  const contracts = useMemo(
    () =>
      getContractsForConfig(
        contractsConfig,
        getArtifactOverrides(currentConfig.name)
      ) as unknown as T,
    [currentConfig]
  );

  const initialContracts = useMemo(
    () => getInitialContracts(contracts),
    [contracts]
  );

  const [status, setStatus] = useState<'initializing' | 'ready' | 'error'>(
    'initializing'
  );
  const [error, setError] = useState<Error | undefined>();
  const [timingInfo, setTimingInfo] = useState<{
    elapsedMs: number;
    contractCount: number;
    fromCache: boolean;
  } | null>(null);
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
    if (!isInitialized || !pxe || initializingRef.current) {
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
  }, [contracts, currentConfig, initialContracts, isInitialized, pxe, showTimingToast, checkContractsCached]);

  const contextValue = useMemo<ContractContextValue<T>>(
    () => ({
      registry: registryRef.current,
      status,
      error,
    }),
    [status, error]
  );

  if (!isInitialized || !embeddedConnector || !pxe) {
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

const FALLBACK_CONTRACT_CONTEXT: ContractContextValue<ContractConfigMap> = {
  registry: null,
  status: 'error',
  error: new Error('Contract registry context not available'),
};

export function useContractRegistryContext<
  T extends ContractConfigMap = ContractConfigMap,
>(): ContractContextValue<T> {
  const context = useContext(ContractRegistryContext);

  if (context === null) {
    return FALLBACK_CONTRACT_CONTEXT as ContractContextValue<T>;
  }

  return context as ContractContextValue<T>;
}
