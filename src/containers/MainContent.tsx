import React, { useState } from 'react';
import { Tabs, SecurityWarning } from '../components';
import { useUniversalWallet } from '../hooks';
import { TabConfig, TabType } from '../types';
import { isEmbeddedConnector } from '../types/walletConnector';
import { ContractInteractionCard } from './ContractInteractionCard';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';

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
      icon: '💰',
      component: <DripperCard />,
    },
    {
      id: 'contract',
      label: 'Contract UI',
      icon: '🧰',
      component: <ContractInteractionCard />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      component: <SettingsCard />,
    },
  ];

  return (
    <main className="main-content">
      {showSecurityWarning && <SecurityWarning />}
      <Tabs tabs={tabs} defaultTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};
