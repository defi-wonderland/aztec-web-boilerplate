import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn, iconSize } from '../../../utils';

const styles = {
  container: 'flex items-center gap-2',
  address:
    'font-mono text-sm bg-surface-secondary px-3 py-2 rounded-lg border border-default',
  addressText: 'text-default',
  copyButton:
    'p-1 rounded hover:bg-surface-tertiary transition-colors text-muted hover:text-default',
  copySuccess: 'text-green-500',
} as const;

export interface AddressDisplayProps {
  /** The address to display */
  address: string;
  /** Number of characters to show at start (default: 6) */
  startChars?: number;
  /** Number of characters to show at end (default: 4) */
  endChars?: number;
  /** Whether to show copy button (default: true) */
  showCopy?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Truncate an address for display
 */
function truncateAddress(
  address: string,
  startChars = 6,
  endChars = 4
): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}....${address.slice(-endChars)}`;
}

/**
 * Address display component with copy functionality
 */
export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  startChars = 6,
  endChars = 4,
  showCopy = true,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [address]);

  const truncated = truncateAddress(address, startChars, endChars);

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.address}>
        <span className={styles.addressText}>{truncated}</span>
      </div>
      {showCopy && (
        <button
          onClick={handleCopy}
          className={cn(styles.copyButton, copied && styles.copySuccess)}
          aria-label={copied ? 'Copied!' : 'Copy address'}
        >
          {copied ? <Check size={iconSize()} /> : <Copy size={iconSize()} />}
        </button>
      )}
    </div>
  );
};
