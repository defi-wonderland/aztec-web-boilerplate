import { useQuery } from '@tanstack/react-query';
import { useAztecWallet, hasAppManagedPXE } from '../../aztec-wallet';
import { SharedPXEService } from '../../aztec-wallet/services/aztec/pxe';
import { getNetworkStore } from '../../aztec-wallet/store/network';

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

/** Get the AztecNode from SharedPXEService (only works for app-managed PXE) */
function getAztecNode() {
  const config = getNetworkStore().currentConfig;
  const instance = SharedPXEService.getExistingInstance(config.name);
  return instance?.aztecNode ?? null;
}

/**
 * Hook to fetch network health metrics from PXE.
 *
 * Only works for app-managed PXE connectors (Embedded).
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
  const { isConnected, isPXEInitialized, connector } = useAztecWallet();

  const canFetch = Boolean(
    isConnected && isPXEInitialized && connector && hasAppManagedPXE(connector)
  );

  const { data, isLoading, error } = useQuery<HealthData, Error>({
    queryKey: ['networkHealth', connector?.id],
    queryFn: async (): Promise<HealthData> => {
      const aztecNode = getAztecNode();
      if (!aztecNode) {
        throw new Error('AztecNode not available');
      }

      const startTime = performance.now();
      const blockNumber = await aztecNode.getBlockNumber();
      const endTime = performance.now();

      return {
        blockHeight: blockNumber,
        latency: Math.round(endTime - startTime),
        lastSynced: new Date(),
      };
    },
    enabled: canFetch,
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
