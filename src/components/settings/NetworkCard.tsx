import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
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
    title: 'Sandbox',
    subtitle: 'Local Development',
    icon: '🏠',
  },
  devnet: {
    title: 'Devnet',
    subtitle: 'Public Testnet',
    icon: '🌐',
  },
} as const;

const styles = {
  container:
    'rounded-2xl p-6 flex flex-col gap-4 cursor-pointer transition-all',
  containerActive: 'bg-[#8B5CF6]/10',
  containerSelected: 'bg-[#F3F4F6] ring-2 ring-[#8B5CF6]',
  containerInactive: 'bg-white hover:bg-[#F9FAFB]',
  containerUnavailable: 'bg-[#F3F4F6] opacity-60 cursor-not-allowed',
  header: 'flex items-center gap-3',
  iconBox:
    'w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0',
  iconBoxActive: 'bg-[#8B5CF6]',
  iconBoxInactive: 'bg-[#F3F4F6]',
  titleGroup: 'flex flex-col gap-0.5 flex-1',
  title: 'text-base font-semibold text-[#1A1A1A]',
  subtitle: 'text-xs text-[#6B7280]',
  activeBadge:
    'px-2 py-1 rounded-md bg-[#8B5CF6] text-[11px] font-semibold text-white',
  statsRow: 'flex gap-4',
  statItem: 'flex flex-col gap-0.5 flex-1',
  statLabel: 'text-[11px] text-[#9CA3AF]',
  statValue: 'flex items-center gap-1.5',
  statDot: 'w-2 h-2 rounded-full',
  statDotConnected: 'bg-[#22C55E]',
  statDotIdle: 'bg-[#9CA3AF]',
  statDotUnavailable: 'bg-[#EF4444]',
  statDotChecking: 'bg-[#F59E0B] animate-pulse',
  statValueText: 'text-[13px] font-medium text-[#1A1A1A]',
  statValueTextMuted: 'text-[13px] font-medium text-[#6B7280]',
  statValueTextError: 'text-[13px] font-medium text-[#EF4444]',
  switchButton:
    'flex items-center justify-center gap-2 w-full py-3 px-4 rounded-[10px] bg-[#F3F4F6] text-[13px] font-semibold text-[#4B5563] cursor-pointer hover:bg-[#E5E7EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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
            {isSwitching ? (
              <Loader2 size={iconSize()} className="animate-spin" />
            ) : (
              <RefreshCw size={iconSize()} />
            )}
            {isSwitching ? 'Switching...' : `Switch to ${title}`}
          </button>
        )}
    </div>
  );
};
