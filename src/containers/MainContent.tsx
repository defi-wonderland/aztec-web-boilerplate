import React, { useState, useEffect } from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { SendersCard } from './SendersCard';
import { ContractsCard } from './ContractsCard';
import { DeployContractCard } from './DeployContractCard';
import { Tabs } from '../components';
import { TabConfig, TabType } from '../types';
import { useAzguardWallet } from '../hooks';

export const MainContent: React.FC = () => {
  const { state: azguardState } = useAzguardWallet();
  const [activeTab, setActiveTab] = useState<TabType>('mint');
  
  const allTabs: TabConfig[] = [
    {
      id: 'contracts',
      label: 'Contracts',
      icon: '📄',
      component: <ContractsCard />
    },
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: '💰',
      component: <DripperCard />
    },
    {
      id: 'deploy',
      label: 'Deploy Token',
      icon: '🚀',
      component: <DeployContractCard />
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      component: <SettingsCard />
    },
    {
      id: 'senders',
      label: 'Senders',
      icon: '👥',
      component: <SendersCard />
    }
  ];

  // Filter out Senders tab when Azguard wallet is connected
  const tabs = azguardState.isConnected 
    ? allTabs.filter(tab => tab.id !== 'senders')
    : allTabs;

  // If user is on Senders tab and Azguard wallet connects, switch to Mint tab
  useEffect(() => {
    if (azguardState.isConnected && activeTab === 'senders') {
      setActiveTab('mint');
    }
  }, [azguardState.isConnected, activeTab]);

  return (
    <main className="main-content">
      <Tabs 
        tabs={tabs} 
        defaultTab={activeTab}
        onTabChange={setActiveTab}
      />
    </main>
  );
};
