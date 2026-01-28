import React, { useState, useCallback, useMemo } from 'react';
import { Copy, Check, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  VisuallyHidden,
} from '../../../components/ui';
import { cn, iconSize, truncateAddress } from '../../../utils';
import {
  getNetworkIcon,
  getNetworkDisplayName,
} from '../../config/networkPresets';
import { getAddressEmoji } from '../ConnectButton/ConnectButton';
import { NetworkIcon } from '../shared';
import type { AztecNetwork } from '../../../config/networks/constants';

const styles = {
  content: 'sm:max-w-sm',
  header: 'flex flex-col items-center gap-3 pb-2',
  emojiContainer: [
    'w-16 h-16 rounded-2xl',
    'bg-surface-secondary',
    'border border-default',
    'flex items-center justify-center',
    'text-4xl',
    'shadow-lg',
  ].join(' '),
  statusBadge: [
    'inline-flex items-center gap-1.5',
    'px-2.5 py-1 rounded-full',
    'bg-green-500/10 text-green-500',
    'text-xs font-medium',
  ].join(' '),
  statusDot: 'w-1.5 h-1.5 rounded-full bg-green-500',
  sectionsContainer: 'flex flex-col gap-4 stagger-children',
  section: 'flex flex-col gap-2',
  label: 'text-xs uppercase tracking-wider text-muted font-medium',
  addressContainer: [
    'group relative flex items-center justify-between',
    'bg-surface-secondary px-4 py-3 rounded-xl',
    'border border-default',
    'transition-all duration-200',
  ].join(' '),
  addressContainerCopied: 'animate-copy-flash',
  addressText: ['font-mono text-sm text-default', 'tracking-tight'].join(' '),
  copyButton: [
    'flex items-center justify-center',
    'w-8 h-8 rounded-lg',
    'bg-surface-tertiary hover:bg-accent/10',
    'text-muted hover:text-accent',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  copySuccess: 'bg-green-500/10 text-green-500',
  networkContainer: [
    'flex items-center justify-between',
    'bg-surface-secondary px-4 py-3 rounded-xl',
    'border border-default',
  ].join(' '),
  networkInfo: 'flex items-center gap-3',
  networkIconContainer: [
    'flex items-center justify-center',
    'w-8 h-8 rounded-lg',
    'bg-accent/10 text-accent',
  ].join(' '),
  networkIconText: 'text-base',
  networkName: 'text-sm font-medium text-default',
  networkBadge: [
    'text-xs px-2 py-0.5 rounded-full',
    'bg-surface-tertiary text-muted',
  ].join(' '),
  actions: 'flex flex-col gap-2 pt-2',
  disconnectButton: [
    'w-full justify-center',
    'bg-transparent hover:bg-red-500/10',
    'text-red-400 hover:text-red-500',
    'border border-red-500/20 hover:border-red-500/40',
  ].join(' '),
} as const;

/**
 * Network section component
 */
const NetworkSection: React.FC<{ networkName: AztecNetwork }> = ({
  networkName,
}) => {
  const icon = useMemo(() => getNetworkIcon(networkName), [networkName]);
  const displayName = useMemo(
    () => getNetworkDisplayName(networkName),
    [networkName]
  );

  return (
    <div className={styles.section}>
      <span className={styles.label}>Network</span>
      <div className={styles.networkContainer}>
        <div className={styles.networkInfo}>
          <div className={styles.networkIconContainer}>
            <NetworkIcon icon={icon} className={styles.networkIconText} />
          </div>
          <span className={styles.networkName}>{displayName}</span>
        </div>
        <span className={styles.networkBadge}>Active</span>
      </div>
    </div>
  );
};

export interface AccountModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Connected account address */
  address: string;
  /** Current network name */
  networkName?: AztecNetwork;
  /** Whether to show network section (default: false) */
  showNetwork?: boolean;
  /** Callback when disconnect is clicked */
  onDisconnect?: () => void;
}

/**
 * Account details modal
 *
 * Displays connected account information in a modal dialog:
 * - Avatar with address initials
 * - Account address (with copy button)
 * - Network name (optional)
 * - Disconnect button
 */
export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  onOpenChange,
  address,
  networkName,
  showNetwork = false,
  onDisconnect,
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

  const handleDisconnect = useCallback(() => {
    onDisconnect?.();
    onOpenChange(false);
  }, [onDisconnect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content} aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Account Details</DialogTitle>
        </VisuallyHidden>
        <DialogHeader className={styles.header}>
          <div className={styles.emojiContainer}>
            {getAddressEmoji(address)}
          </div>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} />
            Connected
          </div>
        </DialogHeader>

        <div className={styles.sectionsContainer}>
          {/* Address Section */}
          <div className={styles.section}>
            <span className={styles.label}>Wallet Address</span>
            <div
              className={cn(
                styles.addressContainer,
                copied && styles.addressContainerCopied
              )}
            >
              <span className={styles.addressText} title={address}>
                {truncateAddress(address, 10, 8)}
              </span>
              <button
                onClick={handleCopy}
                className={cn(styles.copyButton, copied && styles.copySuccess)}
                aria-label={copied ? 'Copied!' : 'Copy address'}
              >
                {copied ? (
                  <Check size={iconSize()} />
                ) : (
                  <Copy size={iconSize()} />
                )}
              </button>
            </div>
          </div>

          {/* Network Section */}
          {showNetwork && networkName && (
            <NetworkSection networkName={networkName} />
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <Button
              variant="ghost"
              className={styles.disconnectButton}
              onClick={handleDisconnect}
              icon={<LogOut size={iconSize()} />}
            >
              Disconnect Wallet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
