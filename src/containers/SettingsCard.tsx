import React, { useState, useCallback } from 'react';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import { NetworkSelector, ConfigPanel } from '../components/settings';
import { DEVNET_CONFIG } from '../config/networks/devnet';
import { SANDBOX_CONFIG } from '../config/networks/sandbox';
import { useNetworkAvailability } from '../hooks/useNetworkAvailability';
import { useNetworkHealth } from '../hooks/useNetworkHealth';
import type { AztecNetwork } from '../config/networks/constants';

const styles = {
  container: 'flex flex-col lg:flex-row w-full min-h-[600px]',
} as const;

const NETWORK_CONFIGS = {
  sandbox: SANDBOX_CONFIG,
  devnet: DEVNET_CONFIG,
} as const;

export const SettingsCard: React.FC = () => {
  const { networkName, switchNetwork, disconnect, isConnected, connector } =
    useAztecWallet();

  const healthMetrics = useNetworkHealth();
  const networkAvailability = useNetworkAvailability();
  const [isSwitching, setIsSwitching] = useState(false);

  const activeNetwork = (networkName ?? 'sandbox') as AztecNetwork;

  const handleSelectNetwork = useCallback(
    async (network: AztecNetwork) => {
      if (network === activeNetwork) return;
      if (!isConnected) {
        try {
          await switchNetwork(network);
        } catch (error) {
          console.error('Failed to select network:', error);
        }
      }
    },
    [activeNetwork, isConnected, switchNetwork]
  );

  const showHealthMetrics =
    isConnected && connector && hasAppManagedPXE(connector);

  const handleSwitchNetwork = useCallback(
    async (network: AztecNetwork) => {
      if (isSwitching) return;

      setIsSwitching(true);
      try {
        if (isConnected) {
          await disconnect();
        }
        // Switch to the new network
        await switchNetwork(network);
      } catch (error) {
        console.error('Failed to switch network:', error);
      } finally {
        setIsSwitching(false);
      }
    },
    [isSwitching, isConnected, disconnect, switchNetwork]
  );

  const activeConfig = NETWORK_CONFIGS[activeNetwork];

  return (
    <div className={styles.container}>
      <NetworkSelector
        activeNetwork={activeNetwork}
        selectedNetwork={activeNetwork}
        connectedNetwork={isConnected ? activeNetwork : null}
        networkAvailability={networkAvailability.networks}
        healthMetrics={healthMetrics}
        showHealthMetrics={!!showHealthMetrics}
        onSelectNetwork={handleSelectNetwork}
        onSwitchNetwork={handleSwitchNetwork}
        isSwitching={isSwitching}
        networkConfigs={{
          sandbox: { proverEnabled: NETWORK_CONFIGS.sandbox.proverEnabled },
          devnet: { proverEnabled: NETWORK_CONFIGS.devnet.proverEnabled },
        }}
      />
      <ConfigPanel config={activeConfig} />
    </div>
  );
};
