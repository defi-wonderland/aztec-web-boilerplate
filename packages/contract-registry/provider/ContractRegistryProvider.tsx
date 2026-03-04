import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PXE } from '@aztec/pxe/server';
import type { ContractArtifact } from '@aztec/stdlib/abi';
import {
  ContractRegistryContext,
  type ContractRegistryContextValue,
} from '../context';
import { ContractRegistry } from '../core/ContractRegistry';
import { useContractRegistryStore } from '../store';
import type { ContractRegistryWalletAdapter } from '../adapter';
import type { ContractConfigMap, ContractNames } from '../core/types';

export interface ContractRegistryProviderProps {
  wallet: ContractRegistryWalletAdapter;
  contracts: ContractConfigMap;
  artifacts: Record<string, ContractArtifact> | null;
  onReady?: (info: {
    contractCount: number;
    elapsedMs: number;
    cached: boolean;
  }) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
}

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

export function ContractRegistryProvider({
  wallet,
  contracts,
  artifacts,
  onReady,
  onError,
  children,
}: ContractRegistryProviderProps): React.ReactElement {
  const { setStatus, setRegistry } = useContractRegistryStore();

  const pxe = wallet.getPXE();

  const isReady =
    wallet.isConnected &&
    wallet.isPXEInitialized &&
    pxe !== null &&
    artifacts !== null;

  const initialContracts = useMemo(
    () => getInitialContracts(contracts),
    [contracts]
  );

  const registryRef = useRef<ContractRegistry<ContractConfigMap> | null>(null);
  const initializingRef = useRef(false);
  const prevInputsRef = useRef<{
    pxe: PXE;
    artifacts: Record<string, ContractArtifact>;
    config: object;
  } | null>(null);

  const checkContractsCached = useMemo(
    () =>
      async (
        pxeInstance: PXE,
        contractsList: ContractNames<ContractConfigMap>[],
        networkConfig: object,
        contractsMap: ContractConfigMap
      ): Promise<boolean> => {
        if (contractsList.length === 0) return true;
        // Sequential reads to avoid IndexedDB transaction conflicts
        const results: boolean[] = [];
        for (const name of contractsList) {
          const contractConfig = contractsMap[name];
          if (!contractConfig) {
            results.push(false);
            continue;
          }
          const expectedAddress = AztecAddress.fromString(
            contractConfig.address(networkConfig)
          );
          const existing =
            await pxeInstance.getContractInstance(expectedAddress);
          results.push(Boolean(existing));
        }
        return results.every(Boolean);
      },
    []
  );

  useEffect(() => {
    if (!isReady || !artifacts || !pxe || initializingRef.current) {
      return;
    }

    // Skip if registry was already created with the same PXE + artifacts + config
    const prev = prevInputsRef.current;
    if (
      prev &&
      prev.pxe === pxe &&
      prev.artifacts === artifacts &&
      prev.config === wallet.currentConfig &&
      registryRef.current
    ) {
      return;
    }

    initializingRef.current = true;
    prevInputsRef.current = { pxe, artifacts, config: wallet.currentConfig };

    const initializeRegistry = async () => {
      try {
        const registry = new ContractRegistry(
          pxe,
          contracts,
          wallet.currentConfig,
          artifacts
        );
        registryRef.current = registry;
        setRegistry(registry);

        const allCached = await checkContractsCached(
          pxe,
          initialContracts,
          wallet.currentConfig,
          contracts
        );
        const start = performance.now();
        await registry.registerAll(initialContracts);
        const elapsedMs = performance.now() - start;

        onReady?.({
          contractCount: initialContracts.length,
          elapsedMs,
          cached: allCached,
        });

        setStatus('ready');
      } catch (err) {
        setStatus('error');
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
        console.error('Contract registration failed:', err);
      } finally {
        initializingRef.current = false;
      }
    };

    initializeRegistry();
  }, [
    artifacts,
    wallet.currentConfig,
    contracts,
    initialContracts,
    isReady,
    pxe,
    checkContractsCached,
    setStatus,
    setRegistry,
    onReady,
    onError,
  ]);

  const contextValue = useMemo<ContractRegistryContextValue>(
    () => ({ wallet, contracts }),
    [wallet, contracts]
  );

  return (
    <ContractRegistryContext.Provider value={contextValue}>
      {children}
    </ContractRegistryContext.Provider>
  );
}
