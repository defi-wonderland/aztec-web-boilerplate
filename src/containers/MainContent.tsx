import React, { useState } from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { Tabs, SecurityWarning } from '../components';
import { TabConfig, TabType } from '../types';
import { useAzguardWallet, useAztecWallet } from '../hooks';

export const MainContent: React.FC = () => {
  const { state: azguardState } = useAzguardWallet();
  const { connectedAccount } = useAztecWallet();
  const [activeTab, setActiveTab] = useState<TabType>('mint');
  
  // Show security warning when using embedded wallet (not Azguard)
  const isUsingEmbeddedWallet = connectedAccount && !azguardState.isConnected;

  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: '💰',
      component: <DripperCard />
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      component: <SettingsCard />
    },
  ];

  return (
    <main className="main-content">
      {isUsingEmbeddedWallet && <SecurityWarning />}
      <Tabs 
        tabs={tabs} 
        defaultTab={activeTab}
        onTabChange={setActiveTab}
      />
    </main>
  );
};
