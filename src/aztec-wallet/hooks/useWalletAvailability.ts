import { useMemo, useState, useEffect } from 'react';
import { useEVMStore } from '../store/evm';

/**
 * Hook to check if a specific EVM wallet is installed.
 *
 * Uses EIP-6963 discovery to determine wallet availability.
 * This is useful for showing/hiding wallet options or displaying
 * "Install" links for wallets that aren't detected.
 *
 * @param rdns - The RDNS identifier of the wallet (e.g., 'io.metamask', 'io.rabby')
 * @returns Whether the wallet is installed
 *
 * @example Check if MetaMask is installed
 * ```tsx
 * const isMetaMaskInstalled = useIsWalletInstalled('io.metamask');
 *
 * if (!isMetaMaskInstalled) {
 *   return <a href="https://metamask.io">Install MetaMask</a>;
 * }
 * ```
 *
 * @example Conditional wallet button
 * ```tsx
 * const isRabbyInstalled = useIsWalletInstalled('io.rabby');
 *
 * return (
 *   <button disabled={!isRabbyInstalled}>
 *     {isRabbyInstalled ? 'Connect Rabby' : 'Rabby Not Installed'}
 *   </button>
 * );
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

/**
 * Hook to get availability info for Aztec browser wallets
 *
 * Calls each wallet's `checkInstalled` function asynchronously.
 *
 * @param wallets - Array of wallet configs with optional checkInstalled function
 * @returns Map of wallet id to installation status (undefined while loading)
 *
 * @example
 * ```tsx
 * const availability = useAztecWalletsAvailability([
 *   { id: 'azguard', checkInstalled: async () => { ... } },
 * ]);
 * // availability = { 'azguard': true }
 * ```
 */
export function useAztecWalletsAvailability(
  wallets: Array<{ id: string; checkInstalled?: () => Promise<boolean> }>
): Record<string, boolean | undefined> {
  const [availability, setAvailability] = useState<
    Record<string, boolean | undefined>
  >({});

  // Create a stable key for the wallets array to avoid unnecessary re-runs
  const walletsKey = useMemo(
    () => wallets.map((w) => w.id).join(','),
    [wallets]
  );

  useEffect(() => {
    let cancelled = false;

    const checkAll = async () => {
      const results: Record<string, boolean | undefined> = {};

      // Initialize all as undefined (loading)
      for (const wallet of wallets) {
        results[wallet.id] = undefined;
      }
      setAvailability({ ...results });

      // Check each wallet in parallel
      await Promise.all(
        wallets.map(async (wallet) => {
          if (wallet.checkInstalled) {
            try {
              const isInstalled = await wallet.checkInstalled();
              if (!cancelled) {
                setAvailability((prev) => ({
                  ...prev,
                  [wallet.id]: isInstalled,
                }));
              }
            } catch (error) {
              console.warn(
                `Failed to check if ${wallet.id} is installed:`,
                error
              );
              if (!cancelled) {
                setAvailability((prev) => ({
                  ...prev,
                  [wallet.id]: false,
                }));
              }
            }
          } else {
            // No checkInstalled function, assume unknown (don't show status)
            if (!cancelled) {
              setAvailability((prev) => ({
                ...prev,
                [wallet.id]: undefined,
              }));
            }
          }
        })
      );
    };

    checkAll();

    return () => {
      cancelled = true;
    };
  }, [walletsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return availability;
}
