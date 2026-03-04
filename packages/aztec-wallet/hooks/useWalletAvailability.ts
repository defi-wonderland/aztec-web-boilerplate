import { useMemo, useState, useEffect } from 'react';
import { useEVMStore } from '../store/evm';

/**
 * Check if walletless (E2E test provider) is injected
 * Walletless simulates MetaMask for E2E testing
 */
function isWalletlessInjected(): boolean {
  if (typeof window === 'undefined') return false;
  const ethereum = (
    window as Window & { ethereum?: { isWalletless?: boolean } }
  ).ethereum;
  return !!ethereum?.isWalletless;
}

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
 * const isMetaMaskInstalled = useIsEvmWalletInstalled('io.metamask');
 *
 * if (!isMetaMaskInstalled) {
 *   return <a href="https://metamask.io">Install MetaMask</a>;
 * }
 * ```
 *
 * @example Conditional wallet button
 * ```tsx
 * const isRabbyInstalled = useIsEvmWalletInstalled('io.rabby');
 *
 * return (
 *   <button disabled={!isRabbyInstalled}>
 *     {isRabbyInstalled ? 'Connect Rabby' : 'Rabby Not Installed'}
 *   </button>
 * );
 * ```
 */
export function useIsEvmWalletInstalled(rdns: string | undefined): boolean {
  const discoveredWallets = useEVMStore((state) => state.discoveredWallets);

  // Check for walletless (E2E test provider) - it simulates MetaMask
  const hasWalletless = useMemo(() => isWalletlessInjected(), []);

  return useMemo(() => {
    if (!rdns) return false;
    // If walletless is injected and this is MetaMask, consider it installed
    if (hasWalletless && rdns === 'io.metamask') {
      return true;
    }
    return discoveredWallets.some((wallet) => wallet.info.rdns === rdns);
  }, [rdns, discoveredWallets, hasWalletless]);
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
 * Hook to get availability info for multiple EVM wallets
 *
 * @param wallets - Array of wallet configs with rdns
 * @returns Map of rdns to installation status
 *
 * @example
 * ```tsx
 * const availability = useEvmWalletsAvailability([
 *   { id: 'metamask', rdns: 'io.metamask' },
 *   { id: 'rabby', rdns: 'io.rabby' },
 * ]);
 * // availability = { 'io.metamask': true, 'io.rabby': false }
 * ```
 */
export function useEvmWalletsAvailability(
  wallets: Array<{ rdns?: string }>
): Record<string, boolean> {
  const discoveredWallets = useEVMStore((state) => state.discoveredWallets);

  // Check for walletless (E2E test provider) - it simulates MetaMask
  const hasWalletless = useMemo(() => isWalletlessInjected(), []);

  return useMemo(() => {
    const discoveredRdns = new Set(
      discoveredWallets.map((wallet) => wallet.info.rdns)
    );

    const availability: Record<string, boolean> = {};
    for (const wallet of wallets) {
      if (wallet.rdns) {
        // If walletless is injected and this is MetaMask, consider it installed
        if (hasWalletless && wallet.rdns === 'io.metamask') {
          availability[wallet.rdns] = true;
        } else {
          availability[wallet.rdns] = discoveredRdns.has(wallet.rdns);
        }
      }
    }
    return availability;
  }, [wallets, discoveredWallets, hasWalletless]);
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
