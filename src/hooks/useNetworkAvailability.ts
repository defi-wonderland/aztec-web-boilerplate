import { useQuery } from '@tanstack/react-query';
import { DEVNET_CONFIG } from '../config/networks/devnet';
import { SANDBOX_CONFIG } from '../config/networks/sandbox';
import type { AztecNetwork } from '../config/networks/constants';

const CHECK_INTERVAL = 30000; // Check every 30 seconds
const TIMEOUT = 5000; // 5 second timeout for each check

export type AvailabilityStatus = 'checking' | 'available' | 'unavailable';

export interface NetworkAvailability {
  networks: Record<AztecNetwork, AvailabilityStatus>;
  isChecking: boolean;
}

const NETWORK_CONFIGS: Record<AztecNetwork, { nodeUrl: string }> = {
  sandbox: SANDBOX_CONFIG,
  devnet: DEVNET_CONFIG,
};

/** Generate vite proxy path for network status endpoint (bypasses CORS) */
const getProxyPath = (network: AztecNetwork): string =>
  `/api/${network}-status`;

/**
 * Check if a URL is localhost
 */
function isLocalhost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Check if a network node is reachable.
 * Uses direct fetch for localhost, proxy for remote URLs (CORS).
 */
async function checkNetworkAvailable(
  nodeUrl: string,
  proxyPath?: string
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  // Use proxy for remote URLs (CORS), direct for localhost
  const baseUrl = nodeUrl.endsWith('/') ? nodeUrl.slice(0, -1) : nodeUrl;
  const url = isLocalhost(nodeUrl) ? `${baseUrl}/status` : proxyPath;

  if (!url) {
    clearTimeout(timeoutId);
    return true; // Assume available if no way to check
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * Fetch availability for all networks
 */
async function fetchNetworkAvailability(): Promise<
  Record<AztecNetwork, boolean>
> {
  const entries = Object.entries(NETWORK_CONFIGS) as [
    AztecNetwork,
    { nodeUrl: string },
  ][];

  const results = await Promise.all(
    entries.map(async ([network, config]) => {
      const available = await checkNetworkAvailable(
        config.nodeUrl,
        getProxyPath(network)
      );
      return [network, available] as const;
    })
  );

  return Object.fromEntries(results) as Record<AztecNetwork, boolean>;
}

/**
 * Hook to check availability of all networks.
 *
 * Uses React Query for:
 * - Automatic polling with refetchInterval
 * - Caching and deduplication
 * - Proper cleanup on unmount
 *
 * - Localhost networks: Directly checks if the node is reachable
 * - Remote networks: Uses vite proxy to bypass CORS
 */
export function useNetworkAvailability(): NetworkAvailability {
  const { data, isLoading } = useQuery({
    queryKey: ['networkAvailability'],
    queryFn: fetchNetworkAvailability,
    refetchInterval: CHECK_INTERVAL,
    staleTime: CHECK_INTERVAL - 1000, // Consider stale just before next refetch
  });

  const networks = Object.keys(NETWORK_CONFIGS).reduce(
    (acc, network) => {
      const available = data?.[network as AztecNetwork];
      if (available === undefined) {
        acc[network as AztecNetwork] = 'checking';
      } else {
        acc[network as AztecNetwork] = available ? 'available' : 'unavailable';
      }
      return acc;
    },
    {} as Record<AztecNetwork, AvailabilityStatus>
  );

  return {
    networks,
    isChecking: isLoading,
  };
}
