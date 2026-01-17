/**
 * Example Header using AztecWallet components
 *
 * This demonstrates how simple it is to use the AztecWallet connection system.
 * Just add the provider and ConnectButton - everything else is automatic!
 */

import React from 'react';
import { Hammer } from 'lucide-react';
import { ConnectButton } from '../aztec-wallet';
import { iconSize } from '../utils';
import { ThemeToggle } from './ui';

const styles = {
  navbar:
    'sticky top-0 z-40 w-full backdrop-blur-md bg-surface/80 border-b border-default',
  navContainer:
    'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16',
  navTitle: 'text-xl font-semibold text-default flex items-center gap-2',
  navTitleIcon: 'text-accent',
  navControls: 'flex items-center gap-3',
} as const;

/**
 * Header with AztecWallet connection
 *
 * Shows how simple it is to add wallet connection:
 * - Just add <ConnectButton /> and it handles everything!
 * - NetworkPicker is included automatically when connected (if enabled in config)
 * - Modals are rendered automatically by the provider
 */
export const AztecWalletHeader: React.FC = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Logo */}
        <div className={styles.navTitle}>
          <Hammer size={iconSize('lg')} className={styles.navTitleIcon} />
          Aztec Web Boilerplate
        </div>

        {/* Controls */}
        <div className={styles.navControls}>
          {/* Wallet Connection - handles everything automatically! */}
          <ConnectButton />

          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};
