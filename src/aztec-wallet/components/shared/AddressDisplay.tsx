import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn, iconSize, truncateAddress } from '../../../utils';

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
 * Address display component with copy functionality
 *
 * Displays a truncated Aztec address with an optional copy-to-clipboard button.
 * The address is truncated to show the first and last few characters with
 * ellipsis in between.
 *
 * @param props - Component props
 * @param props.address - The full address to display
 * @param props.startChars - Number of characters to show at start (default: 6)
 * @param props.endChars - Number of characters to show at end (default: 4)
 * @param props.showCopy - Whether to show the copy button (default: true)
 * @param props.className - Additional CSS classes
 *
 * @example Basic usage
 * ```tsx
 * <AddressDisplay address="0x1234567890abcdef1234567890abcdef12345678" />
 * ```
 *
 * @example Custom truncation
 * ```tsx
 * <AddressDisplay
 *   address={account.getAddress().toString()}
 *   startChars={8}
 *   endChars={6}
 * />
 * ```
 *
 * @example Without copy button
 * ```tsx
 * <AddressDisplay address={address} showCopy={false} />
 * ```
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
