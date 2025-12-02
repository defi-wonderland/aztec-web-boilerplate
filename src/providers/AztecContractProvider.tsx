import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { PXE } from '@aztec/pxe/server';
import type { AppConfig } from '../config/networks';
import {
  ContractRegistry,
  type ContractConfigMap,
  type ContractNames,
  type ContractRegistryContextValue,
  type IContractRegistry,
} from '../contract-registry';

/**
 * Props for the AztecContractProvider
 */
interface AztecContractProviderProps<T extends ContractConfigMap> {
  /** Contract configurations created with createContractConfig */
  contracts: T;
  /** PXE instance for contract registration */
  pxe: PXE;
  /** App configuration for deriving addresses and deploy params */
  config: AppConfig;
  /**
   * List of contract names to register at initialization.
   * - undefined (default): Register all contracts at init
   * - string[]: Register only specified contracts at init
   * - []: Register no contracts at init (all on-demand)
   */
  initialContracts?: ContractNames<T>[];
  /** Optional loading component to show during initialization */
  loadingComponent?: ReactNode;
  /** React children */
  children: ReactNode;
}

/**
 * Internal context type with generic support
 */
type ContractContextValue<T extends ContractConfigMap = ContractConfigMap> = 
  ContractRegistryContextValue<T>;

/**
 * Context for the contract registry
 * Using 'unknown' as the generic parameter for the context to allow type-safe access via hooks
 */
const ContractRegistryContext = createContext<ContractContextValue | null>(null);

/**
 * AztecContractProvider
 *
 * Provides contract registration and access throughout the app.
 * Supports both eager (at init) and lazy (on-demand) contract registration.
 *
 * @example
 * ```tsx
 * // Load all contracts at init (default)
 * <AztecContractProvider contracts={aztecContracts} pxe={pxe} config={config}>
 *   {children}
 * </AztecContractProvider>
 *
 * // Load specific contracts at init, rest are on-demand
 * <AztecContractProvider
 *   contracts={aztecContracts}
 *   pxe={pxe}
 *   config={config}
 *   initialContracts={['dripper', 'token']}
 * >
 *   {children}
 * </AztecContractProvider>
 *
 * // All contracts on-demand (none at init)
 * <AztecContractProvider
 *   contracts={aztecContracts}
 *   pxe={pxe}
 *   config={config}
 *   initialContracts={[]}
 * >
 *   {children}
 * </AztecContractProvider>
 * ```
 */
export function AztecContractProvider<T extends ContractConfigMap>({
  contracts,
  pxe,
  config,
  initialContracts,
  loadingComponent,
  children,
}: AztecContractProviderProps<T>): React.ReactElement {
  const [status, setStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [error, setError] = useState<Error | undefined>();
  const registryRef = useRef<ContractRegistry<T> | null>(null);
  const initializingRef = useRef(false);

  // Create registry instance
  useEffect(() => {
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const initializeRegistry = async () => {
      try {
        // Create new registry
        const registry = new ContractRegistry(pxe, contracts, config);
        registryRef.current = registry;

        // Determine which contracts to register at init
        const contractsToLoad = initialContracts === undefined
          ? (Object.keys(contracts) as ContractNames<T>[]) // All contracts
          : initialContracts; // Specified list (can be empty)

        // Register eager contracts
        if (contractsToLoad.length > 0) {
          await registry.registerAll(contractsToLoad);
        }

        setStatus('ready');
        setError(undefined);
      } catch (err) {
        const registrationError = err instanceof Error ? err : new Error(String(err));
        setError(registrationError);
        setStatus('error');
        console.error('Contract registration failed:', registrationError);
      } finally {
        initializingRef.current = false;
      }
    };

    initializeRegistry();
  }, [pxe, contracts, config, initialContracts]);

  // Memoize context value
  const contextValue = useMemo<ContractContextValue<T>>(
    () => ({
      registry: registryRef.current,
      status,
      error,
    }),
    [status, error]
  );

  // Show loading state during initialization (only if there are contracts to register)
  const shouldShowLoading = status === 'initializing' && 
    (initialContracts === undefined || initialContracts.length > 0);

  if (shouldShowLoading) {
    return (
      <>
        {loadingComponent ?? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-4" />
              <p className="text-sm opacity-70">Initializing contracts...</p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <ContractRegistryContext.Provider value={contextValue as ContractContextValue}>
      {children}
    </ContractRegistryContext.Provider>
  );
}

/**
 * Hook to access the raw contract registry context
 * @internal Use useContract or useContractRegistry instead
 */
export function useContractRegistryContext<
  T extends ContractConfigMap = ContractConfigMap
>(): ContractContextValue<T> {
  const context = useContext(ContractRegistryContext);

  if (context === null) {
    throw new Error(
      'useContractRegistryContext must be used within an AztecContractProvider'
    );
  }

  return context as ContractContextValue<T>;
}
