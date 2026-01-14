import { create } from 'zustand';
import {
  SANDBOX_CONFIG,
  DEVNET_CONFIG,
  type NetworkConfig,
} from '../../config/networks';
import { isValidConfig } from '../../utils';
import { getContractRegistryStore } from '../contractRegistry';
import type { AztecNetwork } from '../../config/networks/constants';
import type { NetworkPreset } from '../../sdk/walletKitConfig';

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
  initialize: (presets: NetworkPreset[]) => void;
  switchToNetwork: (name: string) => boolean;
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

  switchToNetwork: (name) => {
    const { configuredNetworks, currentConfig } = get();
    const config = configuredNetworks[name as AztecNetwork];
    if (config && config.name !== currentConfig.name) {
      getContractRegistryStore().reset();
      set({ currentConfig: config });
      localStorage.setItem(STORAGE_KEY, name);
      return true;
    }
    return false;
  },

  resetToDefault: () => {
    const { defaultNetwork, configuredNetworks } = get();
    const defaultConfig = configuredNetworks[defaultNetwork] ?? SANDBOX_CONFIG;
    localStorage.setItem(STORAGE_KEY, defaultNetwork);
    set({ currentConfig: defaultConfig });
  },

  syncFromStorage: () => {
    const { configuredNetworks } = get();
    const savedNetwork = localStorage.getItem(
      STORAGE_KEY
    ) as AztecNetwork | null;
    if (savedNetwork && configuredNetworks[savedNetwork]) {
      set({ currentConfig: configuredNetworks[savedNetwork] });
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
  presets: NetworkPreset[]
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
