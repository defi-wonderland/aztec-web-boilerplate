import { useEffect, useMemo, useState } from 'react';
import type { NetworkConfig } from '../config/networks';

export type NetworkStatus = 'checking' | 'online' | 'offline' | 'error';

export interface NetworkStatusState {
  status: NetworkStatus;
  error: string | null;
}

type InternalState = NetworkStatusState & { networkName: string };

export const useNetworkStatus = (config: NetworkConfig): NetworkStatusState => {
  const { nodeUrl, name } = config;

  const [result, setResult] = useState<InternalState>(() => ({
    networkName: name,
    status: 'checking',
    error: null,
  }));

  useEffect(() => {
    // Cleanup sentinel: when deps change, cleanup runs first setting cancelled=true.
    // This prevents stale async results from updating state after a network switch.
    // The AbortController stops the HTTP request; cancelled guards the setState calls.
    let cancelled = false;
    const controller = new AbortController();

    const checkNetwork = async () => {
      try {
        const response = await fetch(nodeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'node_getNodeInfo',
            params: [],
            id: 1,
          }),
          signal: controller.signal,
        });

        if (cancelled) return;

        if (response.ok) {
          setResult({ networkName: name, status: 'online', error: null });
        } else {
          setResult({
            networkName: name,
            status: 'offline',
            error: `Network returned ${response.status}`,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if (cancelled) return;

        setResult({
          networkName: name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to connect',
        });
      }
    };

    void checkNetwork();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nodeUrl, name]);

  // Derive state: if network changed but effect hasn't completed, show 'checking'
  const state = useMemo<NetworkStatusState>(() => {
    if (result.networkName !== name) {
      return { status: 'checking', error: null };
    }
    return { status: result.status, error: result.error };
  }, [result, name]);

  return state;
};
