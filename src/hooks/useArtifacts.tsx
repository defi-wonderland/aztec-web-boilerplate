import React, { useEffect } from 'react';
import { CloudDownload, Database, Zap } from 'lucide-react';
import { useAztecWallet } from '../aztec-wallet';
import { ArtifactService, type LoadSource } from '../services/aztec/artifact';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import { useToast } from './context/useToast';

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
  const { currentConfig } = useAztecWallet();
  const { addToast } = useToast();

  const { artifacts, artifactStatus, setArtifacts, setArtifactStatus } =
    useContractRegistryStore();

  useEffect(() => {
    const abortController = new AbortController();

    setArtifactStatus('loading');

    ArtifactService.getInstance()
      .loadArtifacts(currentConfig)
      .then((result) => {
        if (abortController.signal.aborted) return;

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
        if (abortController.signal.aborted) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setArtifactStatus('error');

        addToast({
          title: 'Failed to load contract artifacts',
          description: error.message,
          variant: 'error',
          duration: 10000,
        });
      });

    return () => {
      abortController.abort();
    };
  }, [currentConfig, showToast, addToast, setArtifacts, setArtifactStatus]);

  return {
    artifacts,
    isReady: artifactStatus === 'ready',
  };
}
