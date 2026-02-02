import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn, iconSize } from '../../../utils';
import {
  getNetworkIcon,
  getNetworkDisplayName,
} from '../../config/networkPresets';
import { useNetworkModal } from '../../hooks/useNetworkModal';
import { useAztecWalletContext } from '../../providers/context';
import { useNetworkStore } from '../../store/network';
import { NetworkIcon } from '../shared';
import type { NetworkPickerVariant } from '../../types';

const styles = {
  // Full variant styles
  buttonFull: [
    'group flex items-center gap-2',
    'pl-2 pr-1.5 py-1.5 rounded-lg',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  chevron: [
    'text-muted',
    'transition-transform duration-200',
    'group-hover:text-default',
  ].join(' '),
  // Compact variant styles
  buttonCompact: [
    'group flex items-center justify-center',
    'h-9 w-9 rounded-lg',
    'bg-surface-secondary hover:bg-surface-tertiary',
    'border border-default hover:border-accent/50',
    'transition-all duration-200',
    'cursor-pointer',
  ].join(' '),
  iconContainer: [
    'flex items-center justify-center',
    'w-6 h-6 rounded-lg',
    'bg-accent/10',
    'transition-colors duration-200',
    'group-hover:bg-accent/20',
  ].join(' '),
  icon: 'text-accent text-sm',
  networkName: 'text-sm font-semibold text-default',
} as const;

export interface NetworkPickerProps {
  /**
   * Display variant
   * - 'full' - Icon + network name
   * - 'compact' - Icon only, smaller button
   */
  variant?: NetworkPickerVariant;
  /** Additional class names */
  className?: string;
}

/**
 * Network picker button component
 *
 * Opens a modal to switch between configured networks.
 * Supports two variants: 'full' (with text) and 'compact' (icon only).
 *
 * The modal is rendered automatically by AztecWalletProvider.
 */
export const NetworkPicker: React.FC<NetworkPickerProps> = ({
  variant = 'full',
  className,
}) => {
  const { config } = useAztecWalletContext();
  const currentConfig = useNetworkStore((state) => state.currentConfig);
  const { open } = useNetworkModal();

  // Get current network info
  const currentNetwork = config.networks.find(
    (n) => n.name === currentConfig.name
  );
  const displayName = getNetworkDisplayName(
    currentConfig.name,
    currentNetwork?.displayName ?? currentConfig.displayName
  );
  const icon = getNetworkIcon(currentConfig.name, currentNetwork?.icon);
  const iconSizeVariant = variant === 'compact' ? 'md' : 'sm';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={open}
        className={cn(styles.buttonCompact, className)}
        title={displayName}
        data-testid="network-picker"
      >
        <div className={styles.iconContainer}>
          <NetworkIcon
            icon={icon}
            size={iconSizeVariant}
            className={styles.icon}
          />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(styles.buttonFull, className)}
      data-testid="network-picker"
    >
      <div className={styles.iconContainer}>
        <NetworkIcon
          icon={icon}
          size={iconSizeVariant}
          className={styles.icon}
        />
      </div>
      <span className={styles.networkName}>{displayName}</span>
      <ChevronDown size={iconSize()} className={styles.chevron} />
    </button>
  );
};
