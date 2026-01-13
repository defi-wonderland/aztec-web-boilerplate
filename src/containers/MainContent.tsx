import React, { useState } from 'react';
import { Coins, Wrench, Settings, Layers } from 'lucide-react';
import { Tabs, SecurityWarning } from '../components';
import { useUniversalWallet } from '../hooks';
import { TabConfig, TabType } from '../types';
import { isEmbeddedConnector } from '../types/walletConnector';
import { ContractInteractionCard } from './ContractInteractionCard';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { UIComponentsShowcase } from './UIComponentsShowcase';

const styles = {
  main: 'flex flex-col gap-6',
  tabIcon: 'h-5 w-5',
} as const;

export const MainContent: React.FC = () => {
  const { connector } = useUniversalWallet();
  const [activeTab, setActiveTab] = useState<TabType>('mint');

  // Show security warning for embedded wallet (stores keys in browser localStorage)
  const showSecurityWarning =
    connector?.getStatus().status === 'connected' &&
    isEmbeddedConnector(connector);

  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: <Coins className={styles.tabIcon} />,
      component: <DripperCard />,
    },
    {
      id: 'contract',
      label: 'Contract UI',
      icon: <Wrench className={styles.tabIcon} />,
      component: <ContractInteractionCard />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className={styles.tabIcon} />,
      component: <SettingsCard />,
    },
    {
      id: 'components',
      label: 'UI Components',
      icon: <Layers className={styles.tabIcon} />,
      component: <UIComponentsShowcase />,
    },
  ];

  return (
    <main className={styles.main}>
      {showSecurityWarning && <SecurityWarning />}
      <Tabs tabs={tabs} defaultTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};
