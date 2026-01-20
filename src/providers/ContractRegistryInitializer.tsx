import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Zap, RefreshCw, CloudDownload } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import { contractsConfig } from '../config/contracts';
import {
  getNetworkArtifacts,
  type NetworkArtifactOverrides,
} from '../config/networkArtifacts';
import {
  ContractRegistry,
  getContractsForConfig,
  type ContractConfigMap,
  type ContractNames,
} from '../contract-registry';
import { useToast } from '../hooks';
import { useUniversalWallet } from '../hooks/context/useUniversalWallet';
import { useContractRegistryStore } from '../store/contractRegistry';
import { hasAppManagedPXE } from '../types/walletConnector';
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
  const { connector, isInitialized, isConnected, currentConfig } =
    useUniversalWallet();
  const { addToast } = useToast();

  // Get PXE from the active connector (embedded or external signer)
  const pxe = hasAppManagedPXE(connector) ? connector.getPXE() : null;

  const [artifacts, setArtifacts] = useState<NetworkArtifactOverrides | null>(
    null
  );
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<Error | null>(null);
  const artifactLoadStartRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArtifacts(null);
    setArtifactError(null);
    setArtifactsLoading(true);
    artifactLoadStartRef.current = performance.now();

    getNetworkArtifacts(currentConfig.name)
      .then((loadedArtifacts) => {
        if (!cancelled) {
          setArtifacts(loadedArtifacts ?? {});
          setArtifactsLoading(false);

          if (
            showTimingToast &&
            currentConfig.useExternalArtifactRegistry &&
            artifactLoadStartRef.current
          ) {
            const elapsed = performance.now() - artifactLoadStartRef.current;
            addToast({
              title: `Artifacts loaded in ${elapsed.toFixed(0)}ms`,
              description: 'Fetched from external registry',
              variant: 'info',
              icon: <CloudDownload size={iconSize('md')} />,
              duration: 5000,
            });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          setArtifactError(error);
          setArtifactsLoading(false);
          addToast({
            title: 'Failed to load contract artifacts',
            description: error.message,
            variant: 'error',
            duration: 10000,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentConfig.name,
    currentConfig.useExternalArtifactRegistry,
    addToast,
    showTimingToast,
  ]);

  // Only register contracts when wallet is connected, PXE is ready, and artifacts loaded
  const isReady =
    isConnected &&
    isInitialized &&
    pxe !== null &&
    artifacts !== null &&
    !artifactsLoading;

  const contracts = useMemo(
    () =>
      artifacts
        ? (getContractsForConfig(contractsConfig, artifacts) as unknown as T)
        : null,
    [artifacts]
  );

  const initialContracts = useMemo(
    () => (contracts ? getInitialContracts(contracts) : []),
    [contracts]
  );

  const { setStatus, setError, setRegistry } = useContractRegistryStore();

  useEffect(() => {
    if (artifactError) {
      setStatus('error');
      setError(artifactError);
    }
  }, [artifactError, setStatus, setError]);

  const registryRef = useRef<ContractRegistry<T> | null>(null);
  const initializingRef = useRef(false);

  const checkContractsCached = useMemo(
    () =>
      async (
        pxeInstance: PXE,
        contractsList: ContractNames<T>[],
        networkConfig: NetworkConfig,
        contractsMap: T
      ): Promise<boolean> => {
        if (contractsList.length === 0) return true;
        const results = await Promise.all(
          contractsList.map(async (name) => {
            const contractConfig = contractsMap[name];
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
    []
  );

  useEffect(() => {
    if (!isReady || !contracts || initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const initializeRegistry = async () => {
      try {
        console.log(
          '[ContractRegistryInitializer] Starting registration with config:',
          {
            network: currentConfig.name,
            dripperExpectedAddress: currentConfig.dripperContractAddress,
            tokenExpectedAddress: currentConfig.tokenContractAddress,
            expectedClassIds: currentConfig.classIds,
            deployerAddress: currentConfig.deployerAddress,
            dripperSalt: currentConfig.dripperDeploymentSalt,
            tokenSalt: currentConfig.tokenDeploymentSalt,
            publicKeys: currentConfig.dripperPublicKeys,
          }
        );

        const registry = createRegistry(pxe, contracts, currentConfig);
        registryRef.current = registry;
        setRegistry(registry);

        const allCached = await checkContractsCached(
          pxe,
          initialContracts,
          currentConfig,
          contracts
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
