import { useMemo } from 'react';
import { useEVMStore } from '../store/evm';

/**
 * Hook to check if a specific EVM wallet is installed
 *
 * Uses EIP-6963 discovery results to determine wallet availability.
 *
 * @param rdns - The RDNS identifier of the wallet (e.g., 'io.metamask', 'io.rabby')
 * @returns Whether the wallet is installed
 *
 * @example
 * ```tsx
 * const isMetaMaskInstalled = useIsWalletInstalled('io.metamask');
 * ```
 */
export function useIsWalletInstalled(rdns: string | undefined): boolean {
  const discoveredWallets = useEVMStore((state) => state.discoveredWallets);

  return useMemo(() => {
    if (!rdns) return false;
    return discoveredWallets.some((wallet) => wallet.info.rdns === rdns);
  }, [rdns, discoveredWallets]);
}

/**
 * Hook to get all discovered EVM wallets
 *
 * @returns Array of discovered wallet details from EIP-6963
 */
export function useDiscoveredWallets() {
  return useEVMStore((state) => state.discoveredWallets);
}

/**
 * Hook to get availability info for multiple wallets
 *
 * @param wallets - Array of wallet configs with rdns
 * @returns Map of rdns to installation status
 *
 * @example
 * ```tsx
 * const availability = useWalletsAvailability([
 *   { id: 'metamask', rdns: 'io.metamask' },
 *   { id: 'rabby', rdns: 'io.rabby' },
 * ]);
 * // availability = { 'io.metamask': true, 'io.rabby': false }
 * ```
 */
export function useWalletsAvailability(
  wallets: Array<{ rdns?: string }>
): Record<string, boolean> {
  const discoveredWallets = useEVMStore((state) => state.discoveredWallets);

  return useMemo(() => {
    const discoveredRdns = new Set(
      discoveredWallets.map((wallet) => wallet.info.rdns)
    );

    const availability: Record<string, boolean> = {};
    for (const wallet of wallets) {
      if (wallet.rdns) {
        availability[wallet.rdns] = discoveredRdns.has(wallet.rdns);
      }
    }
    return availability;
  }, [wallets, discoveredWallets]);
}
