import { create } from 'zustand';
import { SANDBOX_CONFIG, DEVNET_CONFIG } from '../../../config/networks';
import { getContractRegistryStore } from '../../../store/contractRegistry';
import { isValidConfig } from '../../../utils';
import { SharedPXEService } from '../../services/aztec/pxe';
import { getWalletStore } from '../wallet';
import type { AztecNetwork, NetworkConfig } from '../../../types/network';
import type { StoreNetworkPreset } from '../../types';

const STORAGE_KEY = 'aztec-wallet-network';

const BASE_CONFIGS: Record<AztecNetwork, NetworkConfig> = {
  sandbox: SANDBOX_CONFIG,
  devnet: DEVNET_CONFIG,
};

type State = {
  currentConfig: NetworkConfig;
  configuredNetworks: Record<AztecNetwork, NetworkConfig>;
  defaultNetwork: AztecNetwork;
  isInitialized: boolean;
};

type Actions = {
  initialize: (presets: StoreNetworkPreset[]) => void;
  updateNetworkConfig: (name: AztecNetwork) => boolean;
  switchToNetwork: (name: AztecNetwork) => Promise<void>;
  resetToDefault: () => void;
  syncFromStorage: () => void;
};

export type NetworkStore = State & Actions;

const INITIAL_STATE: State = {
  currentConfig: DEVNET_CONFIG,
  configuredNetworks: {} as Record<AztecNetwork, NetworkConfig>,
  defaultNetwork: 'devnet',
  isInitialized: false,
};

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  ...INITIAL_STATE,

  initialize: (presets) => {
    const configuredNetworks: Record<AztecNetwork, NetworkConfig> =
      {} as Record<AztecNetwork, NetworkConfig>;
    for (const preset of presets) {
      const base = BASE_CONFIGS[preset.aztecNetwork];
      if (base) {
        configuredNetworks[preset.aztecNetwork] = {
          ...base,
          nodeUrl: preset.nodeUrl,
        };
      }
    }

    const defaultNetwork = presets[0]?.aztecNetwork ?? 'sandbox';
    const defaultConfig = configuredNetworks[defaultNetwork] ?? SANDBOX_CONFIG;

    const savedNetwork = localStorage.getItem(
      STORAGE_KEY
    ) as AztecNetwork | null;
    const initialConfig =
      savedNetwork && configuredNetworks[savedNetwork]
        ? configuredNetworks[savedNetwork]
        : defaultConfig;

    set({
      configuredNetworks,
      defaultNetwork,
      currentConfig: initialConfig,
      isInitialized: true,
    });

    setupCrossTabSync();
  },

  updateNetworkConfig: (name) => {
    const { configuredNetworks, currentConfig } = get();
    const config = configuredNetworks[name as AztecNetwork];
    if (config && config.name !== currentConfig.name) {
      set({ currentConfig: config });
      localStorage.setItem(STORAGE_KEY, name);
      return true;
    }
    return false;
  },

  switchToNetwork: async (name) => {
    const { currentConfig, configuredNetworks, updateNetworkConfig } = get();
    const config = configuredNetworks[name as AztecNetwork];
    if (!config || config.name === currentConfig.name) return;

    // Clean up old PXE before switching config to avoid inconsistent state
    const oldConfigName = currentConfig.name;
    const walletStore = getWalletStore();
    await SharedPXEService.clearInstance(oldConfigName);
    getContractRegistryStore().reset();

    updateNetworkConfig(name);
    walletStore.setPXEStatus('idle');
  },

  resetToDefault: () => {
    const { defaultNetwork, configuredNetworks, currentConfig } = get();
    const defaultConfig = configuredNetworks[defaultNetwork] ?? SANDBOX_CONFIG;
    if (defaultConfig.name !== currentConfig.name) {
      const walletStore = getWalletStore();
      getContractRegistryStore().reset();
      walletStore.setPXEStatus('idle');
    }
    localStorage.setItem(STORAGE_KEY, defaultNetwork);
    set({ currentConfig: defaultConfig });
  },

  syncFromStorage: () => {
    const { configuredNetworks, currentConfig, switchToNetwork } = get();
    const savedNetwork = localStorage.getItem(
      STORAGE_KEY
    ) as AztecNetwork | null;
    if (savedNetwork && configuredNetworks[savedNetwork]) {
      if (configuredNetworks[savedNetwork].name !== currentConfig.name) {
        const walletStore = getWalletStore();
        if (walletStore.status === 'connected') {
          walletStore.switchNetwork(savedNetwork).catch((err) => {
            console.warn('[network-sync] Cross-tab switch failed:', err);
          });
        } else if (walletStore.status === 'disconnected') {
          // Only run the direct switch when truly disconnected to avoid
          // racing an in-flight connection, deployment, or switch
          switchToNetwork(savedNetwork).catch((err) => {
            console.warn('[network-sync] Cross-tab switch failed:', err);
          });
        }
      }
    }
  },
}));

export const getNetworkStore = () => useNetworkStore.getState();

let isListenerSetup = false;
function setupCrossTabSync() {
  if (isListenerSetup) return;
  isListenerSetup = true;

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      getNetworkStore().syncFromStorage();
    }
  });
}

/**
 * Get network options for UI dropdowns.
 * @param configuredNetworks - The configured networks from store
 * @param presets - The original network presets
 */
export const buildNetworkOptions = (
  configuredNetworks: Record<AztecNetwork, NetworkConfig>,
  presets: StoreNetworkPreset[]
) => {
  return presets.map((preset) => {
    const config = configuredNetworks[preset.aztecNetwork];
    return {
      value: preset.aztecNetwork,
      label: config?.displayName ?? preset.aztecNetwork,
      description: config?.description ?? '',
      disabled: !config || !isValidConfig(config),
    };
  });
};
