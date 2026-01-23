import React, { useEffect, useMemo, useRef } from 'react';
import { Zap, RefreshCw } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import { contractsConfig } from '../config/contracts';
import {
  ContractRegistry,
  getContractsForConfig,
  type ContractConfigMap,
  type ContractNames,
} from '../contract-registry';
import { useContractRegistryStore } from '../store/contractRegistry';
import { hasAppManagedPXE } from '../types/walletConnector';
import { iconSize } from '../utils';
import { useToast } from './context/useToast';
import { useUniversalWallet } from './context/useUniversalWallet';
import type { NetworkConfig } from '../config/networks';

const getInitialContracts = <T extends ContractConfigMap>(
  contracts: T
): ContractNames<T>[] => {
  return (Object.entries(contracts) as [ContractNames<T>, T[keyof T]][])
    .filter(([, config]) => !config.lazyRegister)
    .map(([name]) => name);
};

const createRegistry = <T extends ContractConfigMap>(
  pxe: PXE,
  contracts: T,
  config: NetworkConfig
) => new ContractRegistry(pxe, contracts, config);

interface UseContractSetupOptions {
  showToast?: boolean;
}

/**
 * Hook for setting up the contract registry and registering initial contracts.
 *
 * Responsibilities:
 * - Creates ContractRegistry instance when artifacts are ready
 * - Registers initial (non-lazy) contracts with PXE
 * - Stores registry in Zustand state
 * - Shows toast notifications on completion
 *
 * Prerequisites:
 * - Artifacts must be loaded (via useArtifacts)
 * - Wallet must be connected
 * - PXE must be available
 */
export function useContractSetup<
  T extends ContractConfigMap = ContractConfigMap,
>({ showToast = true }: UseContractSetupOptions = {}) {
  const { connector, isInitialized, isConnected, currentConfig } =
    useUniversalWallet();
  const { addToast } = useToast();

  const pxe = hasAppManagedPXE(connector) ? connector.getPXE() : null;

  const { artifacts, artifactStatus, setStatus, setError, setRegistry } =
    useContractRegistryStore();

  const artifactsReady = artifactStatus === 'ready';
  const isReady =
    isConnected && isInitialized && pxe !== null && artifactsReady;

  const contracts = useMemo(() => {
    if (!artifactsReady) return null;
    return (artifacts
      ? getContractsForConfig(contractsConfig, artifacts)
      : contractsConfig) as unknown as T;
  }, [artifacts, artifactsReady]);

  const initialContracts = useMemo(
    () => (contracts ? getInitialContracts(contracts) : []),
    [contracts]
  );

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
    if (!isReady || !contracts || !pxe || initializingRef.current) {
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
          currentConfig,
          contracts
        );
        const start = performance.now();
        await registry.registerAll(initialContracts);
        const elapsedMs = performance.now() - start;

        if (showToast && initialContracts.length > 0) {
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
    showToast,
    checkContractsCached,
    setStatus,
    setError,
    setRegistry,
  ]);
}
