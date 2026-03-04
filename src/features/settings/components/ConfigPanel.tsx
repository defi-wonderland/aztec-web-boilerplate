import React from 'react';
import { Link, Rocket } from 'lucide-react';
import { iconSize } from '../../../utils';
import { ConfigPanelHeader } from './ConfigPanelHeader';
import { ConfigSection } from './ConfigSection';
import { ConfigValueRow } from './ConfigValueRow';
import type { NetworkConfig } from '../../../config/networks/types';

export interface ConfigPanelProps {
  config: NetworkConfig;
  action?: React.ReactNode;
}

const styles = {
  container:
    'flex-1 flex flex-col gap-4 md:gap-7 bg-page px-4 py-4 lg:px-10 lg:py-8',
  sectionsContainer: 'flex flex-col gap-4 md:gap-5',
  contractsGap: 'flex flex-col gap-3 md:gap-4',
} as const;

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, action }) => {
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
          icon={<Rocket size={iconSize()} />}
          iconVariant="amber"
          title="Runtime Info"
        >
          <div className={styles.contractsGap}>
            <ConfigValueRow
              label="Prover"
              value={config.proverEnabled ? 'Enabled' : 'Disabled'}
              showCopy={false}
            />
            <ConfigValueRow
              label="Network Type"
              value={config.isTestnet ? 'Testnet' : 'Local/Private'}
              showCopy={false}
            />
          </div>
        </ConfigSection>
      </div>
    </div>
  );
};
