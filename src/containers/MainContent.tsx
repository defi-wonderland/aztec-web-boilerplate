import React, { useState } from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { Tabs, SecurityWarning } from '../components';
import { TabConfig, TabType } from '../types';
import { useUniversalWallet } from '../hooks';
import { WalletType } from '../types/aztec';

export const MainContent: React.FC = () => {
  const { connector } = useUniversalWallet();
  const [activeTab, setActiveTab] = useState<TabType>('mint');
  
  // Show security warning for embedded wallet (stores keys in browser localStorage)
  const showSecurityWarning = connector?.getStatus().isConnected && connector.type === WalletType.EMBEDDED;

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
      {showSecurityWarning && <SecurityWarning />}
      <Tabs 
        tabs={tabs} 
        defaultTab={activeTab}
        onTabChange={setActiveTab}
      />
    </main>
  );
};
