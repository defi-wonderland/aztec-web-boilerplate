import { useEffect } from 'react';
import { getEIP6963Service, type EIP6963Service } from '../services/evm';
import { getEVMStore } from '../store/evm';

/**
 * Hook that initializes EIP-6963 wallet discovery and syncs discovered wallets to Zustand.
 * @param evmServiceAvailable - Fallback availability check (e.g., window.ethereum exists)
 * @returns The EIP6963Service singleton for provider lookups
 */
export const useEIP6963Discovery = (
  evmServiceAvailable: boolean
): EIP6963Service => {
  const eip6963 = getEIP6963Service();

  useEffect(() => {
    eip6963.discover();

    const unsubscribe = eip6963.subscribe((providers) => {
      getEVMStore().setDiscoveredWallets(providers);
      getEVMStore().setAvailable(providers.length > 0 || evmServiceAvailable);
    });

    return unsubscribe;
  }, [evmServiceAvailable, eip6963]);

  return eip6963;
};
