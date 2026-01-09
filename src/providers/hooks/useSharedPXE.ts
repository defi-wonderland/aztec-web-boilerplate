/**
 * useSharedPXE - Hook for managing shared PXE instance
 *
 * Provides access to the shared PXE service with lazy initialization.
 * Used by both Embedded and External Signer wallet types.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import {
  SharedPXEService,
  type SharedPXEInstance,
} from '../../services/aztec/pxe';
import type { NetworkConfig } from '../../config/networks';
import type { AztecStorageService } from '../../services/aztec/storage';
import type { MinimalWallet } from '../../utils/MinimalWallet';

export interface SharedPXEState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

export interface SharedPXEServices {
  pxe: PXE | null;
  wallet: MinimalWallet | null;
  storageService: AztecStorageService | null;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

export interface SharedPXEActions {
  initialize: () => Promise<SharedPXEInstance>;
  reset: () => void;
}

export interface UseSharedPXEReturn {
  state: SharedPXEState;
  services: SharedPXEServices;
  actions: SharedPXEActions;
}

interface UseSharedPXEOptions {
  config: NetworkConfig;
  autoInitialize?: boolean;
}

/**
 * Hook for accessing shared PXE instance.
 *
 * @param options.config - Network configuration
 * @param options.autoInitialize - Whether to auto-initialize on mount (default: false)
 */
export const useSharedPXE = (
  options: UseSharedPXEOptions
): UseSharedPXEReturn => {
  const { config, autoInitialize = false } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<SharedPXEInstance | null>(null);

  const initPromiseRef = useRef<Promise<SharedPXEInstance> | null>(null);

  // Check if already initialized for this network and reset error state on network change
  useEffect(() => {
    setError(null);

    const existingInstance = SharedPXEService.getExistingInstance(
      config.nodeUrl,
      config.name
    );
    if (existingInstance) {
      setInstance(existingInstance);
      setIsInitialized(true);
    } else {
      setInstance(null);
      setIsInitialized(false);
    }
  }, [config.nodeUrl, config.name]);

  const initialize = useCallback(async (): Promise<SharedPXEInstance> => {
    // Return existing instance if already initialized
    const existing = SharedPXEService.getExistingInstance(
      config.nodeUrl,
      config.name
    );
    if (existing) {
      setInstance(existing);
      setIsInitialized(true);
      return existing;
    }

    // If already initializing, wait for that to complete
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    setIsInitializing(true);
    setError(null);

    const promise = SharedPXEService.getInstance(config.nodeUrl, config.name);
    initPromiseRef.current = promise;

    try {
      const newInstance = await promise;
      setInstance(newInstance);
      setIsInitialized(true);
      return newInstance;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to initialize PXE';
      setError(message);
      throw err;
    } finally {
      setIsInitializing(false);
      initPromiseRef.current = null;
    }
  }, [config.nodeUrl, config.name]);

  const reset = useCallback(() => {
    SharedPXEService.clearInstance(config.nodeUrl, config.name);
    setInstance(null);
    setIsInitialized(false);
    setError(null);
  }, [config.nodeUrl, config.name]);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isInitializing && !error) {
      initialize().catch(console.error);
    }
  }, [autoInitialize, isInitialized, isInitializing, error, initialize]);

  const getSponsoredFeePaymentMethod =
    useCallback(async (): Promise<SponsoredFeePaymentMethod> => {
      if (!instance) {
        throw new Error('PXE not initialized');
      }
      return instance.getSponsoredFeePaymentMethod();
    }, [instance]);

  return {
    state: {
      isInitialized,
      isInitializing,
      error,
    },
    services: {
      pxe: instance?.pxe ?? null,
      wallet: instance?.wallet ?? null,
      storageService: instance?.storageService ?? null,
      getSponsoredFeePaymentMethod,
    },
    actions: {
      initialize,
      reset,
    },
  };
};
