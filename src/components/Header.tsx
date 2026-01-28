import React from 'react';
import { Coins, Wrench, Settings, Layers } from 'lucide-react';
import { ConnectButton } from '../aztec-wallet';
import { useAppNavigation } from '../hooks';
import { cn, iconSize } from '../utils';
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
  navbar: 'sticky top-0 z-40 w-full bg-white border-b border-[#E5E7EB]',
  navContainer: 'flex items-center gap-6 h-[72px] px-10',
  logoGroup: 'flex items-center gap-3',
  logoIcon:
    'w-9 h-9 rounded-[10px] bg-[#8B5CF6] flex items-center justify-center',
  logoIconInner: 'w-5 h-5 bg-white/30 rounded',
  logoText: 'text-[22px] font-bold text-[#1A1A1A]',
  navTabs: 'flex items-center gap-2',
  navTab:
    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer',
  navTabActive: 'bg-[#8B5CF6]/10 text-[#8B5CF6] font-semibold',
  spacer: 'flex-1',
  connectWrapper: 'flex items-center',
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

        <div className={styles.connectWrapper}>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
};
