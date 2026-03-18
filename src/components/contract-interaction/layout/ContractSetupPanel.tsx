import React, { useState } from 'react';
import { Download, Rocket } from 'lucide-react';
import { cn, iconSize } from '../../../utils';
import { Tabs, TabsList, TabsTrigger } from '../../ui';
import { DeployTabContent } from './setup/DeployTabContent';
import { LoadTabContent } from './setup/LoadTabContent';
import { useDeployTab } from './setup/useDeployTab';
import { useLoadTab } from './setup/useLoadTab';
import type { SetupTab } from './setup/setup-utils';
import type { PreconfiguredContract } from '../../../types/preconfiguredContract';

const styles = {
  panel: 'flex flex-col gap-6 p-8 flex-1 overflow-y-auto',
  header: 'flex items-center justify-between',
  title: 'text-2xl font-bold text-default font-display',
  tabsList: 'bg-surface-tertiary border-0 p-1 rounded-xl gap-1',
  tabsTrigger: cn(
    'text-[13px] font-medium gap-1.5 px-4 py-2 rounded-lg',
    'data-[state=active]:bg-surface data-[state=active]:shadow-sm'
  ),
} as const;

interface ContractSetupPanelProps {
  preconfiguredContracts: PreconfiguredContract[];
  savedContracts: Array<{ address: string; label?: string }>;
  artifactInput: string;
  parseError: string | null;
  isLoadingPreconfigured: boolean;
  onLoad: () => void;
  onArtifactChange: (value: string) => void;
  onSelectPreconfigured: (id: string | null) => void;
  onContractLoaded: (contractId: string) => void;
  onSelectExisting: (contractId: string) => void;
}

export const ContractSetupPanel: React.FC<ContractSetupPanelProps> = ({
  preconfiguredContracts,
  savedContracts,
  artifactInput,
  parseError,
  isLoadingPreconfigured,
  onLoad,
  onArtifactChange,
  onSelectPreconfigured,
  onContractLoaded,
  onSelectExisting,
}) => {
  const [activeTab, setActiveTab] = useState<SetupTab>('load');

  const loadTab = useLoadTab({
    preconfiguredContracts,
    savedContracts,
    artifactInput,
    parseError,
    isLoadingPreconfigured,
    onLoad,
    onArtifactChange,
    onSelectPreconfigured,
    onContractLoaded,
    onSelectExisting,
  });

  const deployTab = useDeployTab();

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h1 className={styles.title}>Add Contract</h1>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SetupTab)}
        >
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="load" className={styles.tabsTrigger}>
              <Download size={iconSize()} />
              Load Existing
            </TabsTrigger>
            <TabsTrigger value="deploy" className={styles.tabsTrigger}>
              <Rocket size={iconSize()} />
              Deploy New
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'load' && <LoadTabContent {...loadTab} />}

      {activeTab === 'deploy' && <DeployTabContent {...deployTab} />}
    </div>
  );
};
