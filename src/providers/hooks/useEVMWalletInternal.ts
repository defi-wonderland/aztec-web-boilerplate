import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  EVMWalletService,
  getEVMWalletService,
  getEIP6963Service,
} from '../../services/evm';
import type { EIP6963ProviderDetail } from '../../types/evm';
import type { Hex } from 'viem';

export interface EVMWalletState {
  address: Hex | null;
  isConnected: boolean;
  isConnecting: boolean;
  isAvailable: boolean;
  chainId: number | null;
  error: string | null;
  discoveredWallets: EIP6963ProviderDetail[];
}

export interface EVMWalletActions {
  connect: (rdns?: string) => Promise<Hex | undefined>;
  disconnect: () => void;
  isWalletAvailable: (rdns: string) => boolean;
}

export interface UseEVMWalletInternalReturn {
  state: EVMWalletState;
  actions: EVMWalletActions;
  service: EVMWalletService;
}

export const useEVMWalletInternal = (): UseEVMWalletInternalReturn => {
  const serviceRef = useRef<EVMWalletService>(getEVMWalletService());
  const eip6963Ref = useRef(getEIP6963Service());
  const service = serviceRef.current;
  const eip6963 = eip6963Ref.current;

  const [address, setAddress] = useState<Hex | null>(service.getAddress());
  const [chainId, setChainId] = useState<number | null>(
    service.getState().chainId
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredWallets, setDiscoveredWallets] = useState<
    EIP6963ProviderDetail[]
  >([]);

  const isConnected = address !== null;
  const isAvailable = service.isAvailable() || discoveredWallets.length > 0;

  // Start EIP-6963 discovery on mount
  useEffect(() => {
    eip6963.discover();
    const unsubscribe = eip6963.subscribe((providers) => {
      setDiscoveredWallets(providers);
    });
    return unsubscribe;
  }, [eip6963]);

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      const state = service.getState();
      setAddress(state.address);
      setChainId(state.chainId);
    });
    return unsubscribe;
  }, [service]);

  const handleConnect = useCallback(
    async (rdns?: string): Promise<Hex | undefined> => {
      setIsConnecting(true);
      setError(null);

      try {
        // Try to get specific provider by rdns (EIP-6963)
        const provider = rdns ? eip6963.getProviderByRdns(rdns) : null;

        if (rdns && !provider) {
          // Wallet was requested but not found via EIP-6963
          // Fall back to window.ethereum if available
          if (!service.isAvailable()) {
            setError(
              `Wallet not found. Please install it or check if it's enabled.`
            );
            return undefined;
          }
          console.warn(
            `Wallet ${rdns} not found via EIP-6963, falling back to window.ethereum`
          );
        }

        const connectedAddress = await service.connect(
          provider ?? undefined,
          rdns
        );
        return connectedAddress;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to connect wallet';
        setError(message);
        console.error('EVM wallet connection failed:', err);
        return undefined;
      } finally {
        setIsConnecting(false);
      }
    },
    [service, eip6963]
  );

  const handleDisconnect = useCallback(() => {
    service.disconnect();
    setError(null);
  }, [service]);

  const isWalletAvailable = useCallback(
    (rdns: string): boolean => {
      return eip6963.isWalletAvailable(rdns) || service.isAvailable();
    },
    [eip6963, service]
  );

  const state = useMemo<EVMWalletState>(
    () => ({
      address,
      isConnected,
      isConnecting,
      isAvailable,
      chainId,
      error,
      discoveredWallets,
    }),
    [
      address,
      isConnected,
      isConnecting,
      isAvailable,
      chainId,
      error,
      discoveredWallets,
    ]
  );

  const actions = useMemo<EVMWalletActions>(
    () => ({
      connect: handleConnect,
      disconnect: handleDisconnect,
      isWalletAvailable,
    }),
    [handleConnect, handleDisconnect, isWalletAvailable]
  );

  return {
    state,
    actions,
    service,
  };
};
