import React, { createContext, useCallback, useEffect, ReactNode, useState } from 'react';
import { AppConfig, CustomConfig, DEFAULT_NETWORK, SANDBOX_CONFIG, TESTNET_CONFIG } from '../config/networks';
import { isValidConfig } from '../utils';

interface ConfigContextType {
  currentConfig: AppConfig;
  isCustomConfig: boolean;
  getNetworkOptions: () => Array<{
    value: string;
    label: string;
    description: string;
    disabled: boolean;
  }>;
  switchToNetwork: (networkName: string) => boolean;
  setCustomConfig: (config: Omit<CustomConfig, 'name' | 'displayName' | 'description' | 'isTestnet'>) => void;
  getCustomConfig: () => Omit<CustomConfig, 'name' | 'displayName' | 'description' | 'isTestnet'> | null;
  clearCustomConfig: () => void;
  resetToDefault: () => void;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const CONFIG_STORAGE_KEY = 'bridge-and-seek-config';
const CUSTOM_CONFIG_STORAGE_KEY = 'bridge-and-seek-custom-config';

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(DEFAULT_NETWORK);

  const getCustomConfig = useCallback(() => {
    try {
      const customConfigStr = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
      if (customConfigStr) {
        return JSON.parse(customConfigStr) as Omit<CustomConfig, 'name' | 'displayName' | 'description' | 'isTestnet'>;
      }
    } catch (error) {
      console.error('Error loading custom config:', error);
    }
    return null;
  }, []);

  const createCustomConfig = useCallback((config: Omit<CustomConfig, 'name' | 'displayName' | 'description' | 'isTestnet'>): CustomConfig => ({
    ...config,
    name: 'custom',
    displayName: 'Custom Configuration',
    description: 'User-defined network configuration',
    isTestnet: false,
  }), []);

  const getAvailableNetworks = useCallback((): AppConfig[] => {
    const networks = [SANDBOX_CONFIG, TESTNET_CONFIG];
    
    const customConfig = getCustomConfig();
    if (customConfig) {
      networks.push(createCustomConfig(customConfig));
    }
    
    return networks;
  }, [getCustomConfig, createCustomConfig]);

  const getNetworkOptions = useCallback(() => {
    return getAvailableNetworks().map(network => ({
      value: network.name,
      label: network.displayName,
      description: network.description,
      disabled: !isValidConfig(network),
    }));
  }, [getAvailableNetworks]);

  const switchToNetwork = useCallback((networkName: string): boolean => {
    if (networkName === 'custom') {
      const customConfig = getCustomConfig();
      if (customConfig) {
        setCurrentConfig(createCustomConfig(customConfig));
        localStorage.setItem(CONFIG_STORAGE_KEY, 'custom');
        return true;
      }
      return false;
    }
    
    const network = [SANDBOX_CONFIG, TESTNET_CONFIG].find(n => n.name === networkName);
    if (network) {
      setCurrentConfig(network);
      localStorage.setItem(CONFIG_STORAGE_KEY, networkName);
      return true;
    }
    
    return false;
  }, [getCustomConfig, createCustomConfig]);

  const setCustomConfig = useCallback((config: Omit<CustomConfig, 'name' | 'displayName' | 'description' | 'isTestnet'>) => {
    const customConfig = createCustomConfig(config);
    
    localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(customConfig));
    localStorage.setItem(CONFIG_STORAGE_KEY, 'custom');
    setCurrentConfig(customConfig);
  }, [createCustomConfig]);

  const resetToDefault = useCallback(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, DEFAULT_NETWORK.name);
    localStorage.removeItem(CUSTOM_CONFIG_STORAGE_KEY);
    setCurrentConfig(DEFAULT_NETWORK);
  }, []);

  const clearCustomConfig = useCallback(() => {
    localStorage.removeItem(CUSTOM_CONFIG_STORAGE_KEY);
    localStorage.setItem(CONFIG_STORAGE_KEY, DEFAULT_NETWORK.name);
    setCurrentConfig(DEFAULT_NETWORK);
  }, []);

  useEffect(() => {
    const networkName = localStorage.getItem(CONFIG_STORAGE_KEY);
    
    if (networkName === 'custom') {
      const customConfig = getCustomConfig();
      if (customConfig) {
        setCurrentConfig(createCustomConfig(customConfig));
        return;
      }
    }
    
    if (networkName) {
      const network = [SANDBOX_CONFIG, TESTNET_CONFIG].find(n => n.name === networkName);
      if (network) {
        setCurrentConfig(network);
        return;
      }
    }
    
    setCurrentConfig(DEFAULT_NETWORK);
  }, [getCustomConfig, createCustomConfig]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CONFIG_STORAGE_KEY || e.key === CUSTOM_CONFIG_STORAGE_KEY) {
        const networkName = localStorage.getItem(CONFIG_STORAGE_KEY);
        
        if (networkName === 'custom') {
          const customConfig = getCustomConfig();
          if (customConfig) {
            setCurrentConfig(createCustomConfig(customConfig));
            return;
          }
        }
        
        if (networkName) {
          const network = [SANDBOX_CONFIG, TESTNET_CONFIG].find(n => n.name === networkName);
          if (network) {
            setCurrentConfig(network);
            return;
          }
        }
        
        setCurrentConfig(DEFAULT_NETWORK);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [getCustomConfig, createCustomConfig]);

  const contextValue: ConfigContextType = {
    currentConfig,
    isCustomConfig: currentConfig.name === 'custom',
    getNetworkOptions,
    switchToNetwork,
    setCustomConfig,
    getCustomConfig,
    resetToDefault,
    clearCustomConfig,
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};
