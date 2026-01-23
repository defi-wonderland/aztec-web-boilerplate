import React, { useEffect, useRef } from 'react';
import { CloudDownload } from 'lucide-react';
import { ArtifactService } from '../services/aztec/artifact';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import { useToast } from './context/useToast';
import { useUniversalWallet } from './context/useUniversalWallet';

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

  const loadingConfigRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadingConfigRef.current === currentConfig.name) return;
    loadingConfigRef.current = currentConfig.name;

    setArtifactStatus('loading');
    setArtifactError(null);

    ArtifactService.getInstance()
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
        loadingConfigRef.current = null;

        addToast({
          title: 'Failed to load contract artifacts',
          description: error.message,
          variant: 'error',
          duration: 10000,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConfig]);

  return {
    artifacts,
    artifactStatus,
    isReady: artifactStatus === 'ready',
    isLoading: artifactStatus === 'loading',
    isError: artifactStatus === 'error',
  };
}
