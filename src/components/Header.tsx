import React from 'react';
import { Coins, Wrench, Settings, Layers } from 'lucide-react';
import { ConnectButton } from '../aztec-wallet';
import { useAppNavigation } from '../hooks';
import { cn, iconSize } from '../utils';
import { ThemeToggle } from './ui';
import type { TabType } from '../types';

interface NavTab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const NAV_TABS: NavTab[] = [
  { id: 'mint', label: 'Mint Tokens', icon: <Coins size={iconSize()} /> },
  { id: 'contract', label: 'Contract UI', icon: <Wrench size={iconSize()} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={iconSize()} /> },
  {
    id: 'components',
    label: 'UI Components',
    icon: <Layers size={iconSize()} />,
  },
];

const styles = {
  navbar: 'sticky top-0 z-40 w-full bg-surface border-b border-default',
  navContainer: 'flex items-center gap-6 h-[72px] px-10',
  logoGroup: 'flex items-center gap-3',
  logoIcon: 'w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center',
  logoIconInner: 'w-5 h-5 bg-white/30 rounded',
  logoText: 'text-[22px] font-bold text-default',
  navTabs: 'flex items-center gap-2',
  navTab: cn(
    'flex items-center gap-2 px-4 py-2.5 rounded-lg',
    'text-sm font-medium text-muted',
    'hover:bg-surface-tertiary transition-colors cursor-pointer'
  ),
  navTabActive: 'bg-accent/10 text-accent font-semibold',
  spacer: 'flex-1',
  rightSection: 'flex items-center gap-3',
} as const;

export const Header: React.FC = () => {
  const { activeTab, setActiveTab } = useAppNavigation();

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Logo */}
        <div className={styles.logoGroup}>
          <div className={styles.logoIcon}>
            <div className={styles.logoIconInner} />
          </div>
          <span className={styles.logoText}>Aztec</span>
        </div>

        <div className={styles.navTabs}>
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                styles.navTab,
                activeTab === tab.id && styles.navTabActive
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.spacer} />

        <div className={styles.rightSection}>
          <ThemeToggle />
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
};
