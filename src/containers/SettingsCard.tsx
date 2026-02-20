import React, { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import { NetworkSelector, ConfigPanel } from '../components/settings';
import { Button } from '../components/ui';
import { DEVNET_CONFIG } from '../config/networks/devnet';
import { SANDBOX_CONFIG } from '../config/networks/sandbox';
import { useNetworkAvailability } from '../hooks/useNetworkAvailability';
import { useNetworkHealth } from '../hooks/useNetworkHealth';
import { iconSize } from '../utils';
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
  const [selectedNetwork, setSelectedNetwork] =
    useState<AztecNetwork>(activeNetwork);

  const handleSelectNetwork = useCallback((network: AztecNetwork) => {
    setSelectedNetwork(network);
  }, []);

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
        setSelectedNetwork(network);
      } catch (error) {
        console.error('Failed to switch network:', error);
      } finally {
        setIsSwitching(false);
      }
    },
    [isSwitching, isConnected, disconnect, switchNetwork]
  );

  const selectedConfig = NETWORK_CONFIGS[selectedNetwork];
  const selectedAvailability = networkAvailability.networks[selectedNetwork];
  const canSwitch =
    selectedNetwork !== activeNetwork &&
    selectedAvailability !== 'unavailable' &&
    selectedAvailability !== 'checking';

  const switchAction = canSwitch && (
    <Button
      variant="secondary"
      size="sm"
      icon={<RefreshCw size={iconSize()} />}
      disabled={isSwitching}
      isLoading={isSwitching}
      onClick={() => handleSwitchNetwork(selectedNetwork)}
    >
      {isSwitching ? 'Switching...' : `Switch to ${selectedConfig.displayName}`}
    </Button>
  );

  return (
    <div className={styles.container}>
      <NetworkSelector
        activeNetwork={activeNetwork}
        selectedNetwork={selectedNetwork}
        connectedNetwork={isConnected ? activeNetwork : null}
        networkAvailability={networkAvailability.networks}
        healthMetrics={healthMetrics}
        showHealthMetrics={!!showHealthMetrics}
        onSelectNetwork={handleSelectNetwork}
        networkConfigs={{
          sandbox: { proverEnabled: NETWORK_CONFIGS.sandbox.proverEnabled },
          devnet: { proverEnabled: NETWORK_CONFIGS.devnet.proverEnabled },
        }}
      />
      <ConfigPanel config={selectedConfig} action={switchAction} />
    </div>
  );
};
