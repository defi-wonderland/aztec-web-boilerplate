import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Hex } from 'viem';
import {
  EVMWalletService,
  getEVMWalletService,
} from '../../services/evm/EVMWalletService';

export interface EVMWalletState {
  address: Hex | null;
  isConnected: boolean;
  isConnecting: boolean;
  isAvailable: boolean;
  chainId: number | null;
  error: string | null;
}

export interface EVMWalletActions {
  connect: () => Promise<Hex | undefined>;
  disconnect: () => void;
}

export interface UseEVMWalletInternalReturn {
  state: EVMWalletState;
  actions: EVMWalletActions;
  service: EVMWalletService;
}

const DEFAULT_EVM_WALLET_STATE: EVMWalletState = {
  address: null,
  isConnected: false,
  isConnecting: false,
  isAvailable: false,
  chainId: null,
  error: null,
};

/**
 * Internal hook for managing EVM wallet connections.
 * Used by UniversalWalletProvider to provide EVM wallet functionality.
 */
export const useEVMWalletInternal = (): UseEVMWalletInternalReturn => {
  const serviceRef = useRef<EVMWalletService>(getEVMWalletService());
  const service = serviceRef.current;

  const [address, setAddress] = useState<Hex | null>(service.getAddress());
  const [chainId, setChainId] = useState<number | null>(
    service.getState().chainId
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = address !== null;
  const isAvailable = service.isAvailable();

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      const state = service.getState();
      setAddress(state.address);
      setChainId(state.chainId);
    });
    return unsubscribe;
  }, [service]);

  const handleConnect = useCallback(async (): Promise<Hex | undefined> => {
    if (!isAvailable) {
      setError(
        'No wallet provider found. Please install any EVM compatible wallet.'
      );
      return undefined;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const connectedAddress = await service.connect();
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
  }, [service, isAvailable]);

  const handleDisconnect = useCallback(() => {
    service.disconnect();
    setError(null);
  }, [service]);

  const state = useMemo<EVMWalletState>(
    () => ({
      address,
      isConnected,
      isConnecting,
      isAvailable,
      chainId,
      error,
    }),
    [address, isConnected, isConnecting, isAvailable, chainId, error]
  );

  const actions = useMemo<EVMWalletActions>(
    () => ({
      connect: handleConnect,
      disconnect: handleDisconnect,
    }),
    [handleConnect, handleDisconnect]
  );

  return {
    state,
    actions,
    service,
  };
};
