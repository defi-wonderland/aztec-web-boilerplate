import React from 'react';
import { cn } from '../../../utils';
import { IconRenderer } from './IconRenderer';
import { Spinner } from './Spinner';
import type { IconType } from '../../types';

const styles = {
  button: [
    'group w-full flex items-center gap-3',
    'px-4 py-3 rounded-xl',
    'bg-surface-secondary',
    'border border-transparent',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  buttonEnabled: 'hover:bg-surface-tertiary hover:border-accent/30',
  buttonDisabled: 'cursor-not-allowed opacity-50',
  buttonActive: 'border-accent/50 bg-accent/5',
  iconContainer: [
    'flex items-center justify-center',
    'w-10 h-10 rounded-xl',
    'bg-surface-tertiary',
    'transition-all duration-200',
    'overflow-hidden',
  ].join(' '),
  iconContainerEnabled: 'group-hover:bg-accent/10',
  iconContainerActive: 'bg-accent/10',
  iconContainerDisabled: 'grayscale',
  iconImage: 'w-6 h-6 rounded-lg object-contain',
  content: 'flex-1 flex flex-col items-start gap-0.5',
  name: 'text-sm font-semibold text-default',
  nameDisabled: 'text-muted',
  notInstalledText: 'text-[10px] text-amber-500',
  status: 'flex items-center gap-2',
  statusDot: 'w-2 h-2 rounded-full',
  statusDotInstalled: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
  statusDotNotInstalled: 'bg-amber-500',
  spinnerContainer: 'w-5 h-5',
} as const;

export interface WalletButtonProps {
  /** Wallet name */
  name: string;
  /** Wallet icon - emoji, URL, or React component */
  icon?: IconType;
  /** Whether wallet is installed/available */
  isInstalled?: boolean;
  /** Whether this wallet is currently connecting */
  isConnecting?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
  /** Test ID for e2e testing */
  'data-testid'?: string;
}

/**
 * Button for selecting a wallet
 */
export const WalletButton: React.FC<WalletButtonProps> = ({
  name,
  icon,
  isInstalled,
  isConnecting,
  disabled,
  onClick,
  className,
  'data-testid': testId,
}) => {
  // Disable button if wallet is explicitly not installed
  const isNotInstalled = isInstalled === false;
  const isDisabled = disabled || isConnecting || isNotInstalled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        styles.button,
        isConnecting && styles.buttonActive,
        isNotInstalled ? styles.buttonDisabled : styles.buttonEnabled,
        className
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          styles.iconContainer,
          isConnecting && styles.iconContainerActive,
          isNotInstalled
            ? styles.iconContainerDisabled
            : styles.iconContainerEnabled
        )}
      >
        <IconRenderer icon={icon} className={styles.iconImage} alt={name} />
      </div>

      <div className={styles.content}>
        <span
          className={cn(styles.name, isNotInstalled && styles.nameDisabled)}
        >
          {name}
        </span>
        {isNotInstalled && (
          <span className={styles.notInstalledText}>Not installed</span>
        )}
      </div>

      <div className={styles.status}>
        {isConnecting && (
          <div className={styles.spinnerContainer}>
            <Spinner size="sm" />
          </div>
        )}
        {!isConnecting && isInstalled !== undefined && (
          <span
            className={cn(
              styles.statusDot,
              isInstalled
                ? styles.statusDotInstalled
                : styles.statusDotNotInstalled
            )}
          />
        )}
      </div>
    </button>
  );
};
