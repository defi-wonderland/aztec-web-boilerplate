import React from 'react';
import { ChevronRight, Wallet, Key, CreditCard } from 'lucide-react';
import { Badge } from '../../../components/ui';
import { cn, iconSize } from '../../../utils';

const styles = {
  button: [
    'group w-full flex items-center gap-4',
    'px-4 py-4 rounded-xl',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-transparent hover:border-accent/30',
    'transition-all duration-200',
    'cursor-pointer',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  iconContainer: [
    'flex items-center justify-center',
    'w-10 h-10 rounded-xl',
    'bg-accent/10',
    'text-accent',
    'transition-all duration-200',
    'group-hover:bg-accent/20',
    'group-hover:scale-105',
  ].join(' '),
  content: 'flex-1 flex flex-col items-start gap-0.5',
  label: 'text-sm font-semibold text-default',
  description: 'text-xs text-muted',
  rightSection: 'flex items-center gap-2',
  arrow: [
    'text-muted',
    'transition-all duration-200',
    'group-hover:text-accent',
    'group-hover:translate-x-0.5',
  ].join(' '),
} as const;

/**
 * Get icon based on label hint
 */
function getGroupIcon(label: string): React.ReactNode {
  const lowerLabel = label.toLowerCase();
  if (
    lowerLabel.includes('embedded') ||
    lowerLabel.includes('create') ||
    lowerLabel.includes('new')
  ) {
    return <Key size={iconSize('md')} />;
  }
  if (lowerLabel.includes('evm') || lowerLabel.includes('metamask')) {
    return <CreditCard size={iconSize('md')} />;
  }
  return <Wallet size={iconSize('md')} />;
}

/**
 * Get description based on label hint
 */
function getGroupDescription(label: string): string {
  const lowerLabel = label.toLowerCase();
  if (
    lowerLabel.includes('embedded') ||
    lowerLabel.includes('create') ||
    lowerLabel.includes('new')
  ) {
    return 'Quick setup, no extension needed';
  }
  if (lowerLabel.includes('evm')) {
    return 'MetaMask, Rabby, and more';
  }
  if (lowerLabel.includes('aztec')) {
    return 'Azguard and other Aztec wallets';
  }
  return 'Select a wallet to continue';
}

export interface WalletGroupButtonProps {
  /** Button label */
  label: string;
  /** Optional tag to show next to label (e.g. "Beta") */
  tag?: string;
  /** Whether to show arrow (for navigation) */
  showArrow?: boolean;
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
 * Button for wallet group selection in main view
 */
export const WalletGroupButton: React.FC<WalletGroupButtonProps> = ({
  label,
  tag,
  showArrow = true,
  disabled,
  onClick,
  className,
  'data-testid': testId,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(styles.button, className)}
      data-testid={testId}
    >
      <div className={styles.iconContainer}>{getGroupIcon(label)}</div>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{getGroupDescription(label)}</span>
      </div>
      <div className={styles.rightSection}>
        {tag && <Badge variant="primary">{tag}</Badge>}
        {showArrow && (
          <ChevronRight size={iconSize('md')} className={styles.arrow} />
        )}
      </div>
    </button>
  );
};
