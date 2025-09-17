import React from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { SendersCard } from './SendersCard';
import { ContractsCard } from './ContractsCard';
import { Tabs } from '../components';
import { TabConfig } from '../types';

export const MainContent: React.FC = () => {
  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: '💰',
      component: <DripperCard />
    },
    {
      id: 'contracts',
      label: 'Contracts',
      icon: '📄',
      component: <ContractsCard />
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

  return (
    <main className="main-content">
      <Tabs tabs={tabs} />
    </main>
  );
};
