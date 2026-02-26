import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Zap, RefreshCw } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import { contractsConfig } from '../config/contracts';
import {
  ContractRegistry,
  type ContractConfigMap,
  type ContractNames,
} from '../contract-registry';
import { useArtifacts, useToast } from '../hooks';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import type { NetworkConfig } from '../config/networks';
import type { ResolvedArtifacts } from '../services/aztec/artifact';

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

// Hoist the cast outside the component so the reference is stable across renders
const typedContractsConfig = contractsConfig as unknown as ContractConfigMap;

interface ContractRegistryInitializerProps {
  showTimingToast?: boolean;
  children: ReactNode;
}

const createRegistry = (
  pxe: PXE,
  contracts: ContractConfigMap,
  config: NetworkConfig,
  artifacts: ResolvedArtifacts
) => {
  return new ContractRegistry(pxe, contracts, config, artifacts);
};

export function ContractRegistryInitializer({
  showTimingToast = true,
  children,
}: ContractRegistryInitializerProps): React.ReactElement {
  const { connector, isPXEInitialized, isConnected, currentConfig } =
    useAztecWallet();
  const { addToast } = useToast();

  // Load artifacts first
  const { artifacts, isReady: artifactsReady } = useArtifacts({
    showToast: showTimingToast,
  });

  // Get PXE from the active connector (embedded or external signer)
  const pxe = hasAppManagedPXE(connector) ? connector.getPXE() : null;

  const { setStatus, setRegistry } = useContractRegistryStore();

  // Only register contracts when wallet is connected, PXE is ready, and artifacts are loaded
  const isReady =
    isConnected && isPXEInitialized && pxe !== null && artifactsReady;

  const initialContracts = useMemo(
    () => getInitialContracts(typedContractsConfig),
    []
  );

  const registryRef = useRef<ContractRegistry<ContractConfigMap> | null>(null);
  const initializingRef = useRef(false);

  const checkContractsCached = useMemo(
    () =>
      async (
        pxeInstance: PXE,
        contractsList: ContractNames<ContractConfigMap>[],
        networkConfig: NetworkConfig,
        contractsMap: ContractConfigMap
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
    if (!isReady || !artifacts || !pxe || initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const initializeRegistry = async () => {
      try {
        const registry = createRegistry(
          pxe,
          typedContractsConfig,
          currentConfig,
          artifacts
        );
        registryRef.current = registry;
        setRegistry(registry);

        const allCached = await checkContractsCached(
          pxe,
          initialContracts,
          currentConfig,
          typedContractsConfig
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
      } catch (err) {
        setStatus('error');
        console.error('Contract registration failed:', err);
      } finally {
        initializingRef.current = false;
      }
    };

    initializeRegistry();
  }, [
    addToast,
    artifacts,
    currentConfig,
    initialContracts,
    isReady,
    pxe,
    showTimingToast,
    checkContractsCached,
    setStatus,
    setRegistry,
  ]);

  return <>{children}</>;
}
