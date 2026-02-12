import React from 'react';
import { Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks';
import { cn, iconSize } from '../../utils';

type BadgeVariant = 'blue' | 'red' | 'purple' | 'green';

interface ConfigValueRowBadge {
  text: string;
  variant: BadgeVariant;
}

export interface ConfigValueRowProps {
  label: string;
  value: string;
  badge?: ConfigValueRowBadge;
  showCopy?: boolean;
  className?: string;
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 dark:bg-blue-700/30 text-blue-700 dark:text-blue-400',
  red: 'bg-red-100 dark:bg-red-600/30 text-red-600 dark:text-red-400',
  purple: 'bg-[var(--accent-primary)]/20 text-accent',
  green: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
};

const styles = {
  container: 'flex flex-col gap-1.5 md:gap-2',
  labelRow: 'flex items-center gap-2',
  label: 'text-xs md:text-[13px] font-medium text-muted',
  badge: 'px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-semibold',
  valueContainer:
    'flex items-center gap-2 px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg bg-surface-tertiary',
  value: 'flex-1 text-xs md:text-[13px] text-default font-mono break-all',
  copyButton:
    'w-6 h-6 md:w-7 md:h-7 rounded-md flex items-center justify-center bg-interactive text-muted hover:bg-interactive-hover transition-colors shrink-0',
  copySuccess:
    'text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-500/20',
} as const;

/**
 * ConfigValueRow component for displaying configuration values with copy functionality.
 */
export const ConfigValueRow: React.FC<ConfigValueRowProps> = ({
  label,
  value,
  badge,
  showCopy = true,
  className,
}) => {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.labelRow}>
        {badge && (
          <span className={cn(styles.badge, BADGE_STYLES[badge.variant])}>
            {badge.text}
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </div>

      <div className={styles.valueContainer}>
        <span className={styles.value}>{value}</span>
        {showCopy && (
          <button
            onClick={() => copy(value)}
            className={cn(styles.copyButton, copied && styles.copySuccess)}
            aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
            type="button"
          >
            {copied && <Check size={iconSize()} />}
            {!copied && <Copy size={iconSize()} />}
          </button>
        )}
      </div>
    </div>
  );
};
