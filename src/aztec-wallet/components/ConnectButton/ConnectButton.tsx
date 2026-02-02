import React, { useCallback } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../../components/ui';
import { cn, iconSize, truncateAddress } from '../../../utils';
import { useAztecWalletContext } from '../../providers/context';
import { useModalStore } from '../../store/modal';
import { useWalletStore } from '../../store/wallet';
import { NetworkPicker } from '../NetworkPicker';
import { Spinner } from '../shared';
import type { NetworkPickerVariant } from '../../types';

// Emoji list for wallet avatars
const WALLET_EMOJIS = [
  '🦊',
  '🐸',
  '🦄',
  '🐙',
  '🦋',
  '🌸',
  '🍀',
  '🌈',
  '⭐',
  '🔮',
  '💎',
  '🎭',
  '🎨',
  '🎪',
  '🎯',
  '🎲',
  '🚀',
  '🌙',
  '☀️',
  '🌊',
  '🔥',
  '❄️',
  '⚡',
  '🌺',
  '🍄',
  '🌵',
  '🎸',
  '🎺',
  '🎹',
  '🥁',
  '🎧',
  '🎤',
];

/**
 * Get a consistent emoji based on wallet address
 */
export function getAddressEmoji(address: string): string {
  // Simple hash from address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % WALLET_EMOJIS.length;
  return WALLET_EMOJIS[index];
}

const styles = {
  // Container for network picker + button
  container: 'flex items-center gap-3',
  // Disconnected state - primary CTA
  disconnectedButton: [
    'group relative overflow-hidden',
    'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]',
    'hover:shadow-[0_0_20px_color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
    'transition-all duration-300',
  ].join(' '),
  walletIcon: 'transition-transform duration-300 group-hover:scale-110',
  // Connecting state
  connectingButton: [
    'relative',
    'bg-surface-secondary border-accent/50',
    'animate-shimmer',
  ].join(' '),
  connectingContent: 'flex items-center gap-2',
  // Connected state
  connectedButton: [
    'group flex items-center gap-2',
    'pl-2.5 pr-2 py-1.5 rounded-lg',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  emoji: 'text-base',
  address: 'font-mono text-sm text-default',
  chevron: [
    'text-muted',
    'transition-transform duration-200',
    'group-hover:text-default',
  ].join(' '),
} as const;

export interface ConnectButtonProps {
  /** Label for disconnected state (default: "Connect Wallet") */
  label?: string;
  /**
   * Icon for disconnected state button
   * - undefined: shows default Wallet icon
   * - ReactNode: shows custom icon
   * - false/null: no icon
   */
  icon?: React.ReactNode | false | null;
  /** Additional class names */
  className?: string;
}

/**
 * Connect wallet button
 *
 * A "smart" button that automatically:
 * - Reads wallet state from the store
 * - Opens connect modal when disconnected
 * - Opens account modal when connected
 * - Shows NetworkPicker when connected (if enabled in config)
 *
 * Shows different states:
 * - Disconnected: Gradient CTA button with wallet icon
 * - Connecting: Shimmer loading state
 * - Connected: NetworkPicker + Avatar with truncated address
 *
 * @example
 * ```tsx
 * // Just add the button - it handles everything!
 * <ConnectButton />
 *
 * // Customize the label
 * <ConnectButton label="Sign In" />
 *
 * // Custom icon
 * <ConnectButton icon={<MyIcon />} />
 *
 * // No icon
 * <ConnectButton icon={false} />
 * ```
 */
export const ConnectButton: React.FC<ConnectButtonProps> = ({
  label = 'Connect Wallet',
  icon,
  className,
}) => {
  // Read config from context
  const { config } = useAztecWalletContext();

  // Read wallet state from store
  const walletState = useWalletStore(
    useShallow((state) => ({
      account: state.account,
      status: state.status,
    }))
  );

  // Modal actions
  const { openConnectModal, openAccountModal } = useModalStore(
    useShallow((state) => ({
      openConnectModal: state.openConnectModal,
      openAccountModal: state.openAccountModal,
    }))
  );

  const isConnected = walletState.status === 'connected';
  const isConnecting =
    walletState.status === 'connecting' || walletState.status === 'deploying';
  const address = walletState.account?.getAddress().toString() ?? null;

  // Get network picker variant from config - show always if configured (not just when connected)
  const networkPickerVariant = config.showNetworkPicker as
    | NetworkPickerVariant
    | undefined;
  const showNetworkPicker = !!networkPickerVariant;

  // Handle click based on connection state
  const handleClick = useCallback(() => {
    if (isConnected) {
      openAccountModal();
    } else {
      openConnectModal();
    }
  }, [isConnected, openAccountModal, openConnectModal]);

  // Connecting state
  if (isConnecting) {
    return (
      <Button
        variant="secondary"
        disabled
        className={cn(styles.connectingButton, className)}
      >
        <div className={styles.connectingContent}>
          <Spinner size="sm" />
          <span>Connecting...</span>
        </div>
      </Button>
    );
  }

  // Connected state
  if (isConnected && address) {
    return (
      <div className={styles.container} data-testid="connected-account">
        {showNetworkPicker && <NetworkPicker variant={networkPickerVariant} />}
        <button
          type="button"
          onClick={handleClick}
          className={cn(styles.connectedButton, className)}
          data-testid="account-address"
        >
          <span className={styles.emoji}>{getAddressEmoji(address)}</span>
          <span className={styles.address}>{truncateAddress(address)}</span>
          <ChevronDown size={iconSize()} className={styles.chevron} />
        </button>
      </div>
    );
  }

  // Resolve icon: undefined = default, false/null = none, ReactNode = custom
  const resolvedIcon =
    icon === undefined ? (
      <Wallet size={iconSize()} className={styles.walletIcon} />
    ) : (
      icon || undefined
    );

  // Disconnected state
  return (
    <div className={styles.container}>
      {showNetworkPicker && <NetworkPicker variant={networkPickerVariant} />}
      <Button
        variant="primary"
        onClick={handleClick}
        className={cn(styles.disconnectedButton, className)}
        icon={resolvedIcon}
        data-testid="connect-wallet-button"
      >
        {label}
      </Button>
    </div>
  );
};
