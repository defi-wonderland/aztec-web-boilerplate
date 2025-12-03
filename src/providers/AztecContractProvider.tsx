import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
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
} from '../contract-registry';

// ============================================================================
// 🔧 DEBUG: Set to false to disable the timing popup (or delete this section)
// ============================================================================
const SHOW_TIMING_POPUP = true;

interface TimingToastProps {
  elapsedMs: number;
  contractCount: number;
}

const TimingToast: React.FC<TimingToastProps> = ({ elapsedMs, contractCount }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const isFast = elapsedMs < 500;

  const toastStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: '1rem',
    right: '1rem',
    zIndex: 9999,
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    border: `1px solid ${isFast ? '#22c55e' : '#f59e0b'}`,
    backgroundColor: isFast ? 'rgba(20, 83, 45, 0.95)' : 'rgba(120, 53, 15, 0.95)',
    color: isFast ? '#bbf7d0' : '#fef3c7',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontFamily: 'system-ui, sans-serif',
  };

  const labelText = contractCount !== 1 ? 's' : '';
  const sourceText = isFast ? 'From storage' : 'Fresh registration';

  return (
    <div style={toastStyles}>
      <span style={{ fontSize: '1.5rem' }}>{isFast ? '⚡' : '🐢'}</span>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
          Contracts loaded in {elapsedMs.toFixed(0)}ms
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: 0 }}>
          {contractCount} contract{labelText} • {sourceText}
        </p>
      </div>
      <button 
        onClick={() => setVisible(false)}
        style={{
          marginLeft: '0.5rem',
          opacity: 0.6,
          fontSize: '1rem',
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
        }}
        type="button"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};
// ============================================================================

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
 * Does NOT block rendering - children render immediately.
 * 
 * Components should handle loading states using:
 * - `useContractRegistry().status` for overall registry status
 * - `useContractRegistration(name).isReady` for per-contract status
 * 
 * On initialization, `registerAll()` is called which:
 * 1. Syncs from storage (contracts already registered in IndexedDB are marked ready)
 * 2. Registers any contracts not found in storage
 *
 * @example
 * ```tsx
 * // Initialize all contracts (default)
 * <AztecContractProvider contracts={aztecContracts} pxe={pxe} config={config}>
 *   {children}
 * </AztecContractProvider>
 *
 * // Components handle their own loading:
 * const MyComponent = () => {
 *   const { status } = useContractRegistry();
 *   if (status === 'initializing') return <Loading />;
 *   return <Content />;
 * };
 * ```
 */
export function AztecContractProvider<T extends ContractConfigMap>({
  contracts,
  pxe,
  config,
  initialContracts,
  children,
}: AztecContractProviderProps<T>): React.ReactElement {
  const [status, setStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [error, setError] = useState<Error | undefined>();
  const [timing, setTiming] = useState<{ elapsedMs: number; contractCount: number } | null>(null);
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
        const registry = new ContractRegistry(pxe, contracts, config);
        registryRef.current = registry;

        const contractsToInit = initialContracts === undefined
          ? (Object.keys(contracts) as ContractNames<T>[]) // All contracts
          : initialContracts; // Specified list (can be empty)

        // 🔧 DEBUG: Measure timing
        const startTime = performance.now();
        await registry.registerAll(contractsToInit);
        const elapsedMs = performance.now() - startTime;

        if (SHOW_TIMING_POPUP && contractsToInit.length > 0) {
          setTiming({ elapsedMs, contractCount: contractsToInit.length });
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

  const contextValue = useMemo<ContractContextValue<T>>(
    () => ({
      registry: registryRef.current,
      status,
      error,
    }),
    [status, error]
  );

  return (
    <ContractRegistryContext.Provider value={contextValue as ContractContextValue}>
      {children}
      {/* 🔧 DEBUG: Timing popup - delete this line to remove */}
      {SHOW_TIMING_POPUP && timing && (
        <TimingToast elapsedMs={timing.elapsedMs} contractCount={timing.contractCount} />
      )}
    </ContractRegistryContext.Provider>
  );
}

/**
 * Hook to access the raw contract registry context
 * @internal Use useContract or useContractRegistry instead
 */
const FALLBACK_CONTRACT_CONTEXT: ContractContextValue<ContractConfigMap> = {
  registry: null,
  status: 'error',
  error: new Error('Contract registry context not available'),
};

export function useContractRegistryContext<
  T extends ContractConfigMap = ContractConfigMap
>(): ContractContextValue<T> {
  const context = useContext(ContractRegistryContext);

  if (context === null) {
    return FALLBACK_CONTRACT_CONTEXT as ContractContextValue<T>;
  }

  return context as ContractContextValue<T>;
}
