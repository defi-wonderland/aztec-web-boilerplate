import { useEffect, useRef } from 'react';
import type { NetworkConfig } from '@/config/networks/types';
import {
  ArtifactService,
  type LoadArtifactsResult,
  type ResolvedArtifacts,
} from '../services/artifact';
import { useContractRegistryStore } from '../store';
import type { ContractConfigMap } from '../core/types';
import type { ArtifactStatus } from '../store';

export interface UseArtifactLoaderOptions {
  networkConfig: NetworkConfig;
  contractsConfig: ContractConfigMap;
  onLoaded?: (result: LoadArtifactsResult) => void;
  onError?: (error: Error) => void;
}

export interface UseArtifactLoaderResult {
  artifacts: ResolvedArtifacts | null;
  isReady: boolean;
  status: ArtifactStatus;
}

/**
 * Loads artifacts for the active network and syncs them into contract-registry store state.
 * This hook is package-scoped and exposes side-effect callbacks for app-level UI concerns.
 */
export function useArtifactLoader({
  networkConfig,
  contractsConfig,
  onLoaded,
  onError,
}: UseArtifactLoaderOptions): UseArtifactLoaderResult {
  const { artifacts, artifactStatus, setArtifacts, setArtifactStatus } =
    useContractRegistryStore();

  const loadedNetworkRef = useRef<string | null>(null);
  const onLoadedRef = useRef<typeof onLoaded>(onLoaded);
  const onErrorRef = useRef<typeof onError>(onError);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const networkName = networkConfig.name;

  useEffect(() => {
    if (artifacts === null && loadedNetworkRef.current !== null) {
      loadedNetworkRef.current = null;
    }

    if (loadedNetworkRef.current === networkName) {
      return;
    }

    const abortController = new AbortController();
    setArtifactStatus('loading');

    ArtifactService.getInstance()
      .loadArtifacts(networkConfig, contractsConfig)
      .then((result) => {
        if (abortController.signal.aborted) {
          return;
        }

        loadedNetworkRef.current = networkName;
        setArtifacts(result.artifacts);
        setArtifactStatus('ready');
        onLoadedRef.current?.(result);
      })
      .catch((err) => {
        if (abortController.signal.aborted) {
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setArtifactStatus('error');
        onErrorRef.current?.(error);
      });

    return () => {
      abortController.abort();
    };
  }, [
    artifacts,
    networkName,
    networkConfig,
    contractsConfig,
    setArtifacts,
    setArtifactStatus,
  ]);

  return {
    artifacts,
    isReady: artifactStatus === 'ready',
    status: artifactStatus,
  };
}
