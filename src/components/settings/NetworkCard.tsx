import React from 'react';
import { RefreshCw, Loader2, Home, Globe } from 'lucide-react';
import { AztecNetwork } from '../../config/networks/constants';
import { cn, iconSize } from '../../utils';
import {
  NetworkHealthMetrics,
  type NetworkHealthMetricsProps,
} from './NetworkHealthMetrics';

export type NetworkStatus = 'checking' | 'unavailable' | 'idle' | 'connected';

export interface NetworkCardProps {
  network: AztecNetwork;
  status: NetworkStatus;
  isActive: boolean;
  isSelected?: boolean;
  proverEnabled: boolean;
  healthMetrics?: NetworkHealthMetricsProps;
  onSelect?: () => void;
  onSwitch?: () => void;
  isSwitching?: boolean;
}

const NETWORK_INFO = {
  sandbox: {
    title: 'Local Network',
    subtitle: 'Local Development',
    icon: <Home size={iconSize('md')} />,
  },
  devnet: {
    title: 'Devnet',
    subtitle: 'Public Testnet',
    icon: <Globe size={iconSize('md')} />,
  },
};

const styles = {
  container:
    'rounded-2xl p-4 md:p-6 flex flex-col gap-3 md:gap-4 cursor-pointer transition-all',
  containerActive:
    'bg-[var(--accent-primary)]/10 dark:bg-[var(--accent-primary)]/15',
  containerSelected: 'bg-surface-tertiary ring-2 ring-[var(--accent-primary)]',
  containerInactive: 'bg-surface-tertiary hover:bg-interactive',
  containerUnavailable: 'bg-surface-tertiary opacity-60 cursor-not-allowed',
  header: 'flex items-center gap-3',
  iconBox:
    'w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center text-lg md:text-xl shrink-0',
  iconBoxActive: 'bg-accent',
  iconBoxInactive: 'bg-interactive',
  titleGroup: 'flex flex-col gap-0.5 flex-1',
  title: 'text-[15px] md:text-base font-semibold text-default',
  subtitle: 'text-xs text-muted',
  activeBadge:
    'px-2 py-1 rounded-md bg-accent text-[10px] md:text-[11px] font-semibold text-on-accent',
  statsRow: 'flex gap-4',
  statItem: 'flex flex-col gap-0.5 flex-1',
  statLabel: 'text-[10px] md:text-[11px] text-gray-400',
  statValue: 'flex items-center gap-1.5',
  statDot: 'w-1.5 h-1.5 md:w-2 md:h-2 rounded-full',
  statDotConnected: 'bg-green-500 dark:bg-green-400',
  statDotIdle: 'bg-gray-400',
  statDotUnavailable: 'bg-red-500 dark:bg-red-400',
  statDotChecking: 'bg-amber-500 animate-pulse',
  statValueText: 'text-xs md:text-[13px] font-medium text-default',
  statValueTextMuted: 'text-xs md:text-[13px] font-medium text-muted',
  statValueTextError:
    'text-xs md:text-[13px] font-medium text-red-500 dark:text-red-400',
  switchButton:
    'flex items-center justify-center gap-2 w-full py-2.5 md:py-3 px-4 rounded-[10px] bg-interactive text-xs md:text-[13px] font-semibold text-muted cursor-pointer hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
} as const;

const STATUS_CONFIG = {
  checking: {
    dot: styles.statDotChecking,
    text: 'Checking...',
    textStyle: styles.statValueTextMuted,
  },
  unavailable: {
    dot: styles.statDotUnavailable,
    text: 'Unavailable',
    textStyle: styles.statValueTextError,
  },
  idle: {
    dot: styles.statDotIdle,
    text: 'Idle',
    textStyle: styles.statValueTextMuted,
  },
  connected: {
    dot: styles.statDotConnected,
    text: 'Connected',
    textStyle: styles.statValueText,
  },
} as const;

export const NetworkCard: React.FC<NetworkCardProps> = ({
  network,
  status,
  isActive,
  isSelected = false,
  proverEnabled,
  healthMetrics,
  onSelect,
  onSwitch,
  isSwitching = false,
}) => {
  const { title, subtitle, icon } = NETWORK_INFO[network];
  const isDisabled = status === 'unavailable';
  const statusInfo = STATUS_CONFIG[status];

  const getContainerStyle = () => {
    if (isDisabled) return styles.containerUnavailable;
    if (isActive) return styles.containerActive;
    if (isSelected) return styles.containerSelected;
    return styles.containerInactive;
  };

  return (
    <div
      className={cn(styles.container, getContainerStyle())}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={(e) => e.key === 'Enter' && !isDisabled && onSelect?.()}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
    >
      <div className={styles.header}>
        <div
          className={cn(
            styles.iconBox,
            isActive ? styles.iconBoxActive : styles.iconBoxInactive
          )}
        >
          {icon}
        </div>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        {isActive && <span className={styles.activeBadge}>Active</span>}
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Status</span>
          <div className={styles.statValue}>
            <div className={cn(styles.statDot, statusInfo.dot)} />
            <span className={statusInfo.textStyle}>{statusInfo.text}</span>
          </div>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Prover</span>
          <span
            className={
              isActive ? styles.statValueText : styles.statValueTextMuted
            }
          >
            {proverEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {isActive && healthMetrics && <NetworkHealthMetrics {...healthMetrics} />}

      {!isActive &&
        onSwitch &&
        status !== 'unavailable' &&
        status !== 'checking' && (
          <button
            className={styles.switchButton}
            onClick={onSwitch}
            disabled={isSwitching}
            type="button"
          >
            {isSwitching && (
              <Loader2 size={iconSize()} className="animate-spin" />
            )}
            {!isSwitching && <RefreshCw size={iconSize()} />}
            {isSwitching ? 'Switching...' : `Switch to ${title}`}
          </button>
        )}
    </div>
  );
};
