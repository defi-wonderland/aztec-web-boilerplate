import React from 'react';
import { ConfigSection } from './ConfigSection';
import { ConfigValueRow } from './ConfigValueRow';
import type { NetworkConfig } from '../../config/networks/types';

export interface ConfigPanelProps {
  config: NetworkConfig;
}

const styles = {
  container:
    'flex-1 flex flex-col gap-4 md:gap-7 bg-page px-4 py-4 lg:px-10 lg:py-8',
  header: 'flex items-center gap-3 md:gap-4',
  headerIcon:
    'w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[14px] flex items-center justify-center bg-[var(--accent-primary)]/20 text-lg md:text-[22px]',
  headerContent: 'flex flex-col gap-0.5 md:gap-1',
  headerTitle: 'text-xl md:text-2xl font-bold text-default',
  headerSubtitle: 'text-xs md:text-sm text-muted',
  sectionsContainer: 'flex flex-col gap-4 md:gap-5',
  grid2Col: 'grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4',
  contractsGap: 'flex flex-col gap-3 md:gap-4',
} as const;

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>⚙️</div>
        <div className={styles.headerContent}>
          <span className={styles.headerTitle}>
            {config.displayName} Configuration
          </span>
          <span className={styles.headerSubtitle}>
            {config.description || 'Environment settings'}
          </span>
        </div>
      </div>

      <div className={styles.sectionsContainer}>
        <ConfigSection
          icon="🔗"
          iconVariant="green"
          title="Connection"
          badge={{ text: 'Online', variant: 'online' }}
        >
          <ConfigValueRow label="Node URL" value={config.nodeUrl} />
        </ConfigSection>

        <ConfigSection
          icon="📄"
          iconVariant="purple"
          title="Smart Contracts"
          badge={{ text: '2 deployed', variant: 'count' }}
        >
          <div className={styles.contractsGap}>
            <ConfigValueRow
              label="Token Contract"
              value={config.tokenContractAddress}
              badge={{ text: 'TOKEN', variant: 'blue' }}
            />
            <ConfigValueRow
              label="Dripper Contract"
              value={config.dripperContractAddress}
              badge={{ text: 'FAUCET', variant: 'red' }}
            />
          </div>
        </ConfigSection>

        <ConfigSection icon="🚀" iconVariant="amber" title="Deployment Info">
          <div className={styles.contractsGap}>
            <ConfigValueRow label="Deployer" value={config.deployerAddress} />
            <div className={styles.grid2Col}>
              <ConfigValueRow
                label="Dripper Salt"
                value={config.dripperDeploymentSalt}
                showCopy={false}
              />
              <ConfigValueRow
                label="Token Salt"
                value={config.tokenDeploymentSalt}
                showCopy={false}
              />
            </div>
          </div>
        </ConfigSection>
      </div>
    </div>
  );
};
