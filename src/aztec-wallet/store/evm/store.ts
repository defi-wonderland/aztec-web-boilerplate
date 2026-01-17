/**
 * EVM Wallet Store
 *
 * Manages EVM wallet state (address, connection status, discovered wallets).
 * Actions like connect/disconnect stay in the provider as they need service access.
 */
import { create } from 'zustand';
import type { EIP6963ProviderDetail } from '../../types/evm';
import type { Hex } from 'viem';

type State = {
  address: Hex | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  error: string | null;
  discoveredWallets: EIP6963ProviderDetail[];
  isAvailable: boolean;
};

type Actions = {
  setAddress: (address: Hex | null) => void;
  setConnecting: (connecting: boolean) => void;
  setChainId: (chainId: number | null) => void;
  setError: (error: string | null) => void;
  setDiscoveredWallets: (wallets: EIP6963ProviderDetail[]) => void;
  setAvailable: (available: boolean) => void;
  reset: () => void;
};

export type EVMStore = State & Actions;

const INITIAL_STATE: State = {
  address: null,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  error: null,
  discoveredWallets: [],
  isAvailable: false,
};

export const useEVMStore = create<EVMStore>((set) => ({
  ...INITIAL_STATE,
  setAddress: (address) => set({ address, isConnected: address !== null }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setChainId: (chainId) => set({ chainId }),
  setError: (error) => set({ error }),
  setDiscoveredWallets: (discoveredWallets) =>
    set({ discoveredWallets, isAvailable: discoveredWallets.length > 0 }),
  setAvailable: (isAvailable) => set({ isAvailable }),
  reset: () => set(INITIAL_STATE),
}));

export const getEVMStore = () => useEVMStore.getState();
