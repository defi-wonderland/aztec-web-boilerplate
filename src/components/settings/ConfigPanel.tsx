import React from 'react';
import { Link, FileText, Rocket } from 'lucide-react';
import { iconSize } from '../../utils';
import { getNetworkDeployments } from '../../utils/deployments';
import { ConfigPanelHeader } from './ConfigPanelHeader';
import { ConfigSection } from './ConfigSection';
import { ConfigValueRow } from './ConfigValueRow';
import type { NetworkConfig } from '../../types/network';

export interface ConfigPanelProps {
  config: NetworkConfig;
  action?: React.ReactNode;
}

const styles = {
  container:
    'flex-1 flex flex-col gap-4 md:gap-7 bg-page px-4 py-4 lg:px-10 lg:py-8',
  sectionsContainer: 'flex flex-col gap-4 md:gap-5',
  grid2Col: 'grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4',
  contractsGap: 'flex flex-col gap-3 md:gap-4',
} as const;

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, action }) => {
  const networkDeployments = getNetworkDeployments(config.name);
  const dripper = networkDeployments?.dripper;
  const token = networkDeployments?.token;
  const deploymentsCount = [dripper, token].filter(Boolean).length;

  return (
    <div className={styles.container}>
      <ConfigPanelHeader
        displayName={config.displayName}
        description={config.description}
        action={action}
      />

      <div className={styles.sectionsContainer}>
        <ConfigSection
          icon={<Link size={iconSize()} />}
          iconVariant="green"
          title="Connection"
          badge={{ text: 'Online', variant: 'online' }}
        >
          <ConfigValueRow label="Node URL" value={config.nodeUrl} />
        </ConfigSection>

        <ConfigSection
          icon={<FileText size={iconSize()} />}
          iconVariant="purple"
          title="Smart Contracts"
          badge={
            deploymentsCount > 0
              ? {
                  text: `${deploymentsCount} deployed`,
                  variant: 'count' as const,
                }
              : undefined
          }
        >
          <div className={styles.contractsGap}>
            <ConfigValueRow
              label="Token Contract"
              value={token?.address ?? 'Not configured'}
              badge={{ text: 'TOKEN', variant: 'blue' }}
              showCopy={!!token?.address}
            />
            <ConfigValueRow
              label="Dripper Contract"
              value={dripper?.address ?? 'Not configured'}
              badge={{ text: 'FAUCET', variant: 'red' }}
              showCopy={!!dripper?.address}
            />
          </div>
        </ConfigSection>

        <ConfigSection
          icon={<Rocket size={iconSize()} />}
          iconVariant="amber"
          title="Deployment Info"
        >
          <div className={styles.contractsGap}>
            <ConfigValueRow
              label="Deployer"
              value={dripper?.deployer ?? 'Not configured'}
              showCopy={!!dripper?.deployer}
            />
            <div className={styles.grid2Col}>
              <ConfigValueRow
                label="Dripper Salt"
                value={dripper?.salt ?? 'Not configured'}
                showCopy={false}
              />
              <ConfigValueRow
                label="Token Salt"
                value={token?.salt ?? 'Not configured'}
                showCopy={false}
              />
            </div>
          </div>
        </ConfigSection>
      </div>
    </div>
  );
};
