import React, { useState } from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { ContractInteractionCard } from './ContractInteractionCard';
import { Tabs, SecurityWarning, ClearSigningDemo } from '../components';
import { TabConfig, TabType } from '../types';
import { useUniversalWallet } from '../hooks';
import { isEmbeddedConnector } from '../types/walletConnector';

export const MainContent: React.FC = () => {
  const { connector } = useUniversalWallet();
  const [activeTab, setActiveTab] = useState<TabType>('mint');
  
  // Show security warning for embedded wallet (stores keys in browser localStorage)
  const showSecurityWarning =
    connector?.getStatus().status === 'connected' && isEmbeddedConnector(connector);

  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: '💰',
      component: <DripperCard />
    },
    {
      id: 'contract',
      label: 'Contract UI',
      icon: '🧰',
      component: <ContractInteractionCard />
    },
    {
      id: 'clear-signing',
      label: 'Clear Signing',
      icon: '✍️',
      component: <ClearSigningDemo />
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
      {showSecurityWarning && <SecurityWarning />}
      <Tabs 
        tabs={tabs} 
        defaultTab={activeTab}
        onTabChange={setActiveTab}
      />
    </main>
  );
};
