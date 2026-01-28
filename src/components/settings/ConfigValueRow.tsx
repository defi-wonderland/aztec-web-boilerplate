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
  blue: 'bg-[#DBEAFE] text-[#1D4ED8]', // TOKEN
  red: 'bg-[#FEE2E2] text-[#DC2626]', // FAUCET
  purple: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  green: 'bg-[#DCFCE7] text-[#15803D]',
};

const styles = {
  container: 'flex flex-col gap-2',
  labelRow: 'flex items-center gap-2',
  label: 'text-[13px] font-medium text-[#6B7280]',
  badge: 'px-1.5 py-0.5 rounded text-[10px] font-semibold',
  valueContainer:
    'flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#F3F4F6]',
  value: 'flex-1 text-[13px] text-[#1A1A1A] font-mono break-all',
  copyButton:
    'w-7 h-7 rounded-md flex items-center justify-center bg-[#E5E5E5] text-[#6B7280] hover:bg-[#D1D5DB] transition-colors shrink-0',
  copySuccess: 'text-[#22C55E] bg-[#DCFCE7]',
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
