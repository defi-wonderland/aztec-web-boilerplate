import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
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
  blue: 'bg-[#DBEAFE] dark:bg-[#1d4ed8]/30 text-[#1D4ED8] dark:text-[#60a5fa]', // TOKEN
  red: 'bg-[#FEE2E2] dark:bg-[#dc2626]/30 text-[#DC2626] dark:text-[#f87171]', // FAUCET
  purple:
    'bg-[#8B5CF6]/20 dark:bg-[#a78bfa]/20 text-[#8B5CF6] dark:text-[#a78bfa]',
  green: 'bg-[#DCFCE7] dark:bg-[#22c55e]/20 text-[#15803D] dark:text-[#4ade80]',
};

const styles = {
  container: 'flex flex-col gap-1.5 md:gap-2',
  labelRow: 'flex items-center gap-2',
  label:
    'text-xs md:text-[13px] font-medium text-[#6B7280] dark:text-[#9ca3af]',
  badge: 'px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-semibold',
  valueContainer:
    'flex items-center gap-2 px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg bg-[#F3F4F6] dark:bg-[#2a2a32]',
  value:
    'flex-1 text-xs md:text-[13px] text-[#1A1A1A] dark:text-white font-mono break-all',
  copyButton:
    'w-6 h-6 md:w-7 md:h-7 rounded-md flex items-center justify-center bg-[#E5E5E5] dark:bg-[#3a3a44] text-[#6B7280] dark:text-[#9ca3af] hover:bg-[#D1D5DB] dark:hover:bg-[#4a4a54] transition-colors shrink-0',
  copySuccess:
    'text-[#22C55E] dark:text-[#4ade80] bg-[#DCFCE7] dark:bg-[#22c55e]/20',
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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy value:', err);
    }
  }, [value]);

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
            onClick={handleCopy}
            className={cn(styles.copyButton, copied && styles.copySuccess)}
            aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
            type="button"
          >
            {copied ? <Check size={iconSize()} /> : <Copy size={iconSize()} />}
          </button>
        )}
      </div>
    </div>
  );
};
