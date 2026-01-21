import { useShallow } from 'zustand/react/shallow';
import { useNetworkStore, buildNetworkOptions } from './store';
import type { NetworkPreset } from '../../sdk/walletKitConfig';

/**
 * Network actions
 */
export const useNetworkActions = () =>
  useNetworkStore(
    useShallow((state) => ({
      initialize: state.initialize,
      switchToNetwork: state.switchToNetwork,
      resetToDefault: state.resetToDefault,
    }))
  );

/**
 * Current network config (convenience selector)
 */
export const useCurrentNetwork = () =>
  useNetworkStore((state) => state.currentConfig);

/**
 * Build network options for UI dropdowns
 */
export const useNetworkOptions = (presets: NetworkPreset[]) => {
  const configuredNetworks = useNetworkStore(
    (state) => state.configuredNetworks
  );
  return buildNetworkOptions(configuredNetworks, presets);
};
