import React from 'react';
import { NetworkCard, type NetworkStatus } from './NetworkCard';
import type { AztecNetwork } from '../../config/networks/constants';
import type { AvailabilityStatus } from '../../hooks/useNetworkAvailability';
import type { NetworkHealth } from '../../hooks/useNetworkHealth';

const getNetworkStatus = (
  network: AztecNetwork,
  availability: AvailabilityStatus,
  connectedNetwork: AztecNetwork | null
): NetworkStatus => {
  if (availability === 'checking') return 'checking';
  if (availability === 'unavailable') return 'unavailable';
  if (network === connectedNetwork) return 'connected';
  return 'idle';
};

export interface NetworkSelectorProps {
  activeNetwork: AztecNetwork;
  selectedNetwork: AztecNetwork;
  connectedNetwork: AztecNetwork | null;
  networkAvailability: Record<AztecNetwork, AvailabilityStatus>;
  healthMetrics: NetworkHealth;
  showHealthMetrics: boolean;
  onSelectNetwork: (network: AztecNetwork) => void;
  onSwitchNetwork: (network: AztecNetwork) => void;
  isSwitching: boolean;
  networkConfigs: Record<AztecNetwork, { proverEnabled: boolean }>;
}

const styles = {
  container: 'w-[380px] flex flex-col gap-5 shrink-0 bg-white p-6',
  sectionLabel:
    'text-[13px] font-semibold text-[#9CA3AF] uppercase tracking-[1px]',
  networksSection: 'flex flex-col gap-3',
  tipCard: 'flex gap-3 rounded-xl bg-[#FEF3C7] p-4',
  tipIcon: 'text-base shrink-0',
  tipContent: 'flex flex-col gap-1',
  tipTitle: 'text-[13px] font-semibold text-[#92400E]',
  tipText: 'text-xs text-[#A16207] leading-relaxed',
} as const;

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  activeNetwork,
  selectedNetwork,
  connectedNetwork,
  networkAvailability,
  healthMetrics,
  showHealthMetrics,
  onSelectNetwork,
  onSwitchNetwork,
  isSwitching,
  networkConfigs,
}) => {
  const networks: AztecNetwork[] = ['sandbox', 'devnet'];

  return (
    <div className={styles.container}>
      <span className={styles.sectionLabel}>Networks</span>

      <div className={styles.networksSection}>
        {networks.map((network) => {
          const isActive = network === activeNetwork;
          const isSelected = network === selectedNetwork;
          const status = getNetworkStatus(
            network,
            networkAvailability[network],
            connectedNetwork
          );

          return (
            <NetworkCard
              key={network}
              network={network}
              status={status}
              isActive={isActive}
              isSelected={isSelected}
              proverEnabled={networkConfigs[network].proverEnabled}
              healthMetrics={
                isActive && showHealthMetrics
                  ? {
                      blockHeight: healthMetrics.blockHeight,
                      latency: healthMetrics.latency,
                      lastSynced: healthMetrics.lastSynced,
                      isHealthy: healthMetrics.isHealthy,
                      isLoading: healthMetrics.isLoading,
                    }
                  : undefined
              }
              onSelect={() => onSelectNetwork(network)}
              onSwitch={
                !isActive && connectedNetwork && status === 'idle'
                  ? () => onSwitchNetwork(network)
                  : undefined
              }
              isSwitching={isSwitching && !isActive}
            />
          );
        })}
      </div>

      <div className={styles.tipCard}>
        <span className={styles.tipIcon}>💡</span>
        <div className={styles.tipContent}>
          <span className={styles.tipTitle}>Quick Tip</span>
          <p className={styles.tipText}>
            Use Sandbox for fast local testing. Switch to Devnet for production
            testing.
          </p>
        </div>
      </div>
    </div>
  );
};
