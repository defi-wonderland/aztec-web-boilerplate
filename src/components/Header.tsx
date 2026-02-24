import React, { useState, useCallback } from 'react';
import { Coins, Wrench, Settings, Layers, Menu, X, Globe } from 'lucide-react';
import { ConnectButton, NetworkPicker } from '../aztec-wallet';
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
  navbar: 'sticky top-0 z-40 w-full bg-card border-b border-default',
  navContainer:
    'flex items-center gap-2 md:gap-4 lg:gap-6 h-14 lg:h-[72px] px-4 md:px-6 lg:px-10',
  logoGroup: 'flex items-center gap-2 lg:gap-3',
  logoIcon:
    'w-8 h-8 lg:w-9 lg:h-9 rounded-lg lg:rounded-[10px] bg-accent flex items-center justify-center',
  logoIconInner: 'w-4 h-4 lg:w-5 lg:h-5 bg-white/30 rounded',
  logoText: 'text-lg lg:text-[22px] font-bold text-default',
  // Desktop nav tabs - hidden on mobile
  navTabs: 'hidden md:flex items-center gap-1 lg:gap-2',
  navTab:
    'flex items-center justify-center gap-2 w-9 h-9 lg:w-auto lg:h-auto lg:px-4 lg:py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-surface-tertiary transition-colors cursor-pointer',
  navTabActive:
    'bg-[var(--accent-primary)]/10 dark:bg-[var(--accent-primary)]/15 text-accent',
  navTabLabel: 'hidden lg:inline',
  spacer: 'flex-1',
  // Actions - different for mobile vs desktop
  actionsDesktop: 'hidden md:flex items-center gap-3',
  actionsMobile: 'flex md:hidden items-center gap-2',
  // Mobile hamburger button
  menuButton:
    'md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:bg-surface-tertiary transition-colors',
  // Mobile menu dropdown
  mobileMenu:
    'md:hidden absolute top-14 left-0 right-0 bg-card border-b border-default shadow-lg z-50',
  mobileMenuInner: 'flex flex-col p-2',
  mobileNavTab:
    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:bg-surface-tertiary transition-colors',
  mobileNavTabActive:
    'bg-[var(--accent-primary)]/10 dark:bg-[var(--accent-primary)]/15 text-accent font-semibold',
  mobileDivider: 'h-px bg-gray-200 dark:bg-[var(--border-color)] my-2 mx-2',
  mobileSettingsRow:
    'flex items-center justify-between px-4 py-3 text-sm font-medium text-muted',
  mobileSettingsLabel: 'flex items-center gap-2',
} as const;

export const Header: React.FC = () => {
  const { activeTab, setActiveTab } = useAppNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileNavClick = useCallback(
    (tabId: TabType) => {
      setActiveTab(tabId);
      setMobileMenuOpen(false);
    },
    [setActiveTab]
  );

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Mobile hamburger */}
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? (
            <X size={iconSize('md')} />
          ) : (
            <Menu size={iconSize('md')} />
          )}
        </button>

        {/* Logo */}
        <div className={styles.logoGroup}>
          <div className={styles.logoIcon}>
            <div className={styles.logoIconInner} />
          </div>
          <span className={styles.logoText}>Aztec</span>
        </div>

        {/* Desktop nav tabs */}
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
              <span className={styles.navTabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.spacer} />

        {/* Desktop actions - with NetworkPicker in ConnectButton */}
        <div className={styles.actionsDesktop}>
          <ThemeToggle />
          <ConnectButton />
        </div>

        {/* Mobile actions - wallet only, network in menu */}
        <div className={styles.actionsMobile}>
          <ConnectButton hideNetworkPicker />
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <div className={styles.mobileMenuInner}>
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  styles.mobileNavTab,
                  activeTab === tab.id && styles.mobileNavTabActive
                )}
                onClick={() => handleMobileNavClick(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
            <div className={styles.mobileDivider} />
            <div className={styles.mobileSettingsRow}>
              <span className={styles.mobileSettingsLabel}>
                <Globe size={iconSize()} />
                Network
              </span>
              <NetworkPicker variant="full" />
            </div>
            <div className={styles.mobileSettingsRow}>
              <span className={styles.mobileSettingsLabel}>Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
