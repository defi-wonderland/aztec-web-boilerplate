import React, { type ReactNode, useEffect } from 'react';
import {
  getNetworkStore,
  useCurrentNetwork,
  useNetworkActions,
} from '../aztec-wallet/store/network';
import {
  useWalletActions,
  setupWalletCrossTabSync,
  getWalletStore,
} from '../aztec-wallet/store/wallet';
import { setNetworkPresets } from '../hooks/context/useUniversalWallet';
import { createAztecWalletKit } from '../sdk/walletKit';
import { isValidConfig } from '../utils';
import type { WalletKitConfig } from '../sdk/walletKitConfig';

interface UniversalWalletProviderProps {
  config: WalletKitConfig;
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<
  UniversalWalletProviderProps
> = ({ config: walletKitConfig, children }) => {
  const { initialize: initializeNetwork, resetToDefault } = useNetworkActions();
  const currentConfig = useCurrentNetwork();
  const { setConnectors, disconnect } = useWalletActions();

  useEffect(() => {
    setNetworkPresets(walletKitConfig.networks);

    if (!getNetworkStore().isInitialized) {
      initializeNetwork(walletKitConfig.networks);
    }

    setupWalletCrossTabSync();
  }, [walletKitConfig.networks, initializeNetwork]);

  useEffect(() => {
    if (!isValidConfig(currentConfig)) {
      console.warn(
        `⚠️ Invalid config for ${currentConfig.name}, falling back to default`
      );
      resetToDefault();
    }
  }, [currentConfig, resetToDefault]);

  useEffect(() => {
    if (isValidConfig(currentConfig)) {
      getWalletStore().checkNetwork();
    }
  }, [currentConfig]);

  useEffect(() => {
    const walletKit = createAztecWalletKit({
      aztecNode: currentConfig.nodeUrl,
      connectors: walletKitConfig.connectors,
    });
    setConnectors(walletKit.getConnectors());

    return () => {
      disconnect();
    };
  }, [
    currentConfig.nodeUrl,
    setConnectors,
    walletKitConfig.connectors,
    disconnect,
  ]);

  return <>{children}</>;
};
