import React, { useEffect, useRef } from 'react';
import { CloudDownload, Globe, HardDrive, Zap } from 'lucide-react';
import { useAztecWallet } from '../aztec-wallet';
import { contractsConfig } from '../config/contracts';
import { ArtifactService } from '../services/aztec/artifact';
import { useContractRegistryStore } from '../store/contractRegistry';
import { iconSize } from '../utils';
import { useToast } from './context/useToast';

interface UseArtifactsOptions {
  showToast?: boolean;
}

const SOURCE_TOAST_MAP: Record<
  string,
  { description: string; icon: React.ReactNode }
> = {
  local: {
    description: 'Using bundled artifacts',
    icon: <HardDrive size={iconSize('md')} />,
  },
  registry: {
    description: 'Loaded from artifact registry',
    icon: <CloudDownload size={iconSize('md')} />,
  },
  external: {
    description: 'Loaded from external package',
    icon: <Globe size={iconSize('md')} />,
  },
  cached: {
    description: 'Loaded from cache',
    icon: <Zap size={iconSize('md')} />,
  },
};

const DEFAULT_TOAST_CONFIG = {
  description: 'Artifacts loaded',
  icon: <CloudDownload size={iconSize('md')} />,
};

function getSourceToastConfig(sourceLabel: string) {
  return SOURCE_TOAST_MAP[sourceLabel] ?? DEFAULT_TOAST_CONFIG;
}

/**
 * Hook for loading contract artifacts based on network configuration.
 *
 * Responsibilities:
 * - Loads artifacts via ArtifactService (config-driven source resolution)
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

  // Track which network artifacts were loaded for to avoid duplicate loads
  // when currentConfig object reference changes but network stays the same.
  const loadedNetworkRef = useRef<string | null>(null);

  const networkName = currentConfig.name;

  useEffect(() => {
    if (artifacts === null && loadedNetworkRef.current !== null) {
      loadedNetworkRef.current = null;
    }

    if (loadedNetworkRef.current === networkName) return;

    const abortController = new AbortController();

    setArtifactStatus('loading');

    ArtifactService.getInstance()
      .loadArtifacts(currentConfig, contractsConfig)
      .then((result) => {
        if (abortController.signal.aborted) return;

        loadedNetworkRef.current = networkName;
        setArtifacts(result.artifacts);
        setArtifactStatus('ready');

        if (showToast && result.sourceLabel !== 'local') {
          const toastConfig = getSourceToastConfig(result.sourceLabel);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    networkName,
    artifacts,
    showToast,
    addToast,
    setArtifacts,
    setArtifactStatus,
  ]);

  return {
    artifacts,
    isReady: artifactStatus === 'ready',
  };
}
