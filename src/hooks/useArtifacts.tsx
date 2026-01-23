import React, { useEffect, useMemo, useRef } from 'react';
import { CloudDownload } from 'lucide-react';
import { ArtifactService } from '../services/aztec/artifact';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import { useToast } from './context/useToast';
import { useUniversalWallet } from './context/useUniversalWallet';
import type { NetworkConfig } from '../config/networks';

interface UseArtifactsOptions {
  showToast?: boolean;
}

/**
 * Hook for loading contract artifacts based on network configuration.
 *
 * Responsibilities:
 * - Loads artifacts via ArtifactService
 * - Stores artifacts in Zustand state
 * - Shows toast notifications on load/error
 *
 * This hook should be called once at app initialization.
 */
export function useArtifacts({ showToast = true }: UseArtifactsOptions = {}) {
  const { currentConfig } = useUniversalWallet();
  const { addToast } = useToast();

  const {
    artifacts,
    artifactStatus,
    setArtifacts,
    setArtifactStatus,
    setArtifactError,
  } = useContractRegistryStore();

  const artifactService = useMemo(() => ArtifactService.getInstance(), []);
  const loadingRef = useRef(false);
  const configRef = useRef<NetworkConfig | null>(null);

  useEffect(() => {
    if (loadingRef.current && configRef.current === currentConfig) {
      return;
    }

    loadingRef.current = true;
    configRef.current = currentConfig;

    setArtifactStatus('loading');
    setArtifactError(null);

    artifactService
      .loadArtifacts(currentConfig)
      .then((result) => {
        setArtifacts(result.artifacts);
        setArtifactStatus('ready');

        if (showToast && result.source === 'registry') {
          addToast({
            title: `Artifacts loaded in ${result.elapsedMs.toFixed(0)}ms`,
            description: 'Fetched from external registry',
            variant: 'info',
            icon: <CloudDownload size={iconSize('md')} />,
            duration: 5000,
          });
        }
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setArtifactStatus('error');
        setArtifactError(error);

        addToast({
          title: 'Failed to load contract artifacts',
          description: error.message,
          variant: 'error',
          duration: 10000,
        });
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [
    currentConfig,
    artifactService,
    showToast,
    addToast,
    setArtifacts,
    setArtifactStatus,
    setArtifactError,
  ]);

  return {
    artifacts,
    artifactStatus,
    isReady: artifactStatus === 'ready',
    isLoading: artifactStatus === 'loading',
    isError: artifactStatus === 'error',
  };
}
