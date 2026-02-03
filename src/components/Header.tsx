import React from 'react';
import { Hammer } from 'lucide-react';
import { ConnectButton } from '../aztec-wallet';
import { iconSize } from '../utils';
import { ThemeToggle } from './ui';

const styles = {
  // Navbar container
  navbar:
    'sticky top-0 z-40 w-full backdrop-blur-md bg-surface/80 border-b border-default',
  navContainer:
    'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16',
  // Logo/Title
  navTitle: 'text-xl font-semibold text-default flex items-center gap-2',
  navTitleIcon: 'text-accent',
  // Controls section
  navControls: 'flex items-center gap-3',
} as const;

/**
 * Application header with wallet connection and theme toggle.
 */
export const Header: React.FC = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <div className={styles.navTitle}>
          <Hammer size={iconSize('lg')} className={styles.navTitleIcon} />
          Aztec Web Boilerplate
        </div>
        <div className={styles.navControls}>
          <ConnectButton />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};
