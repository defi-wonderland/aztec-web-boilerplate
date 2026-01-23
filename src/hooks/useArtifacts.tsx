import React, { useEffect, useRef } from 'react';
import { CloudDownload, Database, Zap } from 'lucide-react';
import { ArtifactService, type LoadSource } from '../services/aztec/artifact';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import { useToast } from './context/useToast';
import { useUniversalWallet } from './context/useUniversalWallet';

interface UseArtifactsOptions {
  showToast?: boolean;
}

function getSourceToastConfig(source: LoadSource): {
  description: string;
  icon: React.ReactNode;
} {
  switch (source) {
    case 'memory':
      return {
        description: 'Loaded from memory cache',
        icon: <Zap size={iconSize('md')} />,
      };
    case 'indexeddb':
      return {
        description: 'Loaded from browser cache',
        icon: <Database size={iconSize('md')} />,
      };
    case 'network':
      return {
        description: 'Fetched from external registry',
        icon: <CloudDownload size={iconSize('md')} />,
      };
    default:
      return {
        description: 'Artifacts loaded',
        icon: <CloudDownload size={iconSize('md')} />,
      };
  }
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

        if (showToast && result.source !== 'local') {
          const toastConfig = getSourceToastConfig(result.source);
          addToast({
            title: `Artifacts loaded in ${result.elapsedMs.toFixed(0)}ms`,
            description: toastConfig.description,
            variant: 'info',
            icon: toastConfig.icon,
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
