import React from 'react';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { SendersCard } from './SendersCard';
import { BridgeOutCard } from './BridgeOutCard';
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
      id: 'bridge-out',
      label: 'Bridge Out',
      icon: '🌉',
      component: <BridgeOutCard />
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
