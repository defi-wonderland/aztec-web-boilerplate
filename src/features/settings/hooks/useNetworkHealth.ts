import { useQuery } from '@tanstack/react-query';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { useAztecWallet, WalletType } from '@aztec-wallet';

const DEFAULT_REFRESH_INTERVAL = 30_000; // 30 seconds

export interface NetworkHealth {
  blockHeight: number | null;
  latency: number | null;
  lastSynced: Date | null;
  isHealthy: boolean;
  isLoading: boolean;
  error: string | null;
}

interface HealthData {
  blockHeight: number;
  latency: number;
  lastSynced: Date;
}

/**
 * Hook to fetch network health metrics from PXE.
 *
 * Only works for app-managed PXE connectors (Embedded/ExternalSigner).
 * Returns null values for browser wallets (Azguard) since they manage their own PXE.
 *
 * @param refreshInterval - How often to refresh metrics in milliseconds (default: 10000)
 * @returns NetworkHealth object with block height, latency, last synced timestamp, and status
 *
 * @example
 * ```tsx
 * const { blockHeight, latency, lastSynced, isHealthy, isLoading } = useNetworkHealth();
 *
 * if (isLoading) return <Spinner />;
 *
 * return (
 *   <div>
 *     <span>Block: {blockHeight}</span>
 *     <span>Latency: {latency}ms</span>
 *     <span>Healthy: {isHealthy ? 'Yes' : 'No'}</span>
 *   </div>
 * );
 * ```
 */
export function useNetworkHealth(
  refreshInterval: number = DEFAULT_REFRESH_INTERVAL
): NetworkHealth {
  const {
    isConnected,
    isPXEInitialized,
    walletType,
    networkName,
    currentConfig,
  } = useAztecWallet();

  const canFetch = Boolean(
    isConnected && isPXEInitialized && walletType !== WalletType.BROWSER_WALLET
  );

  const nodeUrl = currentConfig?.nodeUrl;

  const { data, isLoading, error } = useQuery<HealthData, Error>({
    queryKey: ['networkHealth', networkName],
    queryFn: async (): Promise<HealthData> => {
      if (!nodeUrl) {
        throw new Error('Node URL not available');
      }

      const node = createAztecNodeClient(nodeUrl);
      const startTime = performance.now();
      const blockNumber = await node.getBlockNumber();
      const endTime = performance.now();

      return {
        blockHeight: blockNumber,
        latency: Math.round(endTime - startTime),
        lastSynced: new Date(),
      };
    },
    enabled: canFetch && !!nodeUrl,
    refetchInterval: canFetch ? refreshInterval : false,
    staleTime: refreshInterval / 2,
    retry: false,
  });

  // Return null state when not ready or using browser wallet
  if (!canFetch) {
    return {
      blockHeight: null,
      latency: null,
      lastSynced: null,
      isHealthy: false,
      isLoading: false,
      error: null,
    };
  }

  return {
    blockHeight: data?.blockHeight ?? null,
    latency: data?.latency ?? null,
    lastSynced: data?.lastSynced ?? null,
    isHealthy: data ? data.latency < 5000 : false,
    isLoading,
    error: error?.message ?? null,
  };
}
