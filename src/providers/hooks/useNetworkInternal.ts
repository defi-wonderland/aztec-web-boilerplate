/**
 * Internal hook for network configuration management
 * Used by UniversalWalletProvider - not for direct consumption
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { SANDBOX_CONFIG, DEVNET_CONFIG, type NetworkConfig } from '../../config/networks';
import type { AztecNetwork } from '../../config/networks/constants';
import type { NetworkPreset } from '../../sdk/walletKitConfig';
import { isValidConfig } from '../../utils';

const NETWORK_STORAGE_KEY = 'aztec-wallet-network';

// Base network configs (without nodeUrl override)
const BASE_CONFIGS: Record<AztecNetwork, NetworkConfig> = {
  sandbox: SANDBOX_CONFIG,
  devnet: DEVNET_CONFIG,
};

export interface NetworkState {
  currentConfig: NetworkConfig;
}

export interface NetworkActions {
  switchToNetwork: (networkName: string) => boolean;
  resetToDefault: () => void;
  getNetworkOptions: () => Array<{
    value: string;
    label: string;
    description: string;
    disabled: boolean;
  }>;
}

export interface UseNetworkInternalReturn {
  state: NetworkState;
  actions: NetworkActions;
}

interface UseNetworkInternalOptions {
  networks: NetworkPreset[];
}

export const useNetworkInternal = (
  options: UseNetworkInternalOptions
): UseNetworkInternalReturn => {
  const { networks } = options;

  // Build configs from presets (apply nodeUrl overrides)
  const configuredNetworks = useMemo(() => {
    const result: Record<AztecNetwork, NetworkConfig> = {} as Record<AztecNetwork, NetworkConfig>;
    for (const preset of networks) {
      const base = BASE_CONFIGS[preset.aztecNetwork];
      if (base) {
        result[preset.aztecNetwork] = { ...base, nodeUrl: preset.nodeUrl };
      }
    }
    return result;
  }, [networks]);

  // Default is first network in the list
  const defaultNetwork = networks[0]?.aztecNetwork ?? 'sandbox';
  const defaultConfig = configuredNetworks[defaultNetwork] ?? SANDBOX_CONFIG;

  const [currentConfig, setCurrentConfig] = useState<NetworkConfig>(defaultConfig);

  const getNetworkOptions = useCallback(() => {
    return networks.map((preset) => {
      const config = configuredNetworks[preset.aztecNetwork];
      return {
        value: preset.aztecNetwork,
        label: config?.displayName ?? preset.aztecNetwork,
        description: config?.description ?? '',
        disabled: !config || !isValidConfig(config),
      };
    });
  }, [networks, configuredNetworks]);

  const switchToNetwork = useCallback((networkName: string): boolean => {
    const config = configuredNetworks[networkName as AztecNetwork];
    if (config) {
      setCurrentConfig(config);
      localStorage.setItem(NETWORK_STORAGE_KEY, networkName);
      return true;
    }
    return false;
  }, [configuredNetworks]);

  const resetToDefault = useCallback(() => {
    localStorage.setItem(NETWORK_STORAGE_KEY, defaultNetwork);
    setCurrentConfig(defaultConfig);
  }, [defaultNetwork, defaultConfig]);

  // Load saved network on mount
  useEffect(() => {
    const savedNetwork = localStorage.getItem(NETWORK_STORAGE_KEY) as AztecNetwork | null;
    if (savedNetwork && configuredNetworks[savedNetwork]) {
      setCurrentConfig(configuredNetworks[savedNetwork]);
    }
  }, [configuredNetworks]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === NETWORK_STORAGE_KEY) {
        const networkName = e.newValue as AztecNetwork | null;
        if (networkName && configuredNetworks[networkName]) {
          setCurrentConfig(configuredNetworks[networkName]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [configuredNetworks]);

  return {
    state: { currentConfig },
    actions: { switchToNetwork, resetToDefault, getNetworkOptions },
  };
};
