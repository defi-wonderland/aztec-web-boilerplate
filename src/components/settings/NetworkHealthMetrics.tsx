import React, { useMemo } from 'react';
import { formatRelativeTime } from '../../utils';

export interface NetworkHealthMetricsProps {
  blockHeight: number | null;
  latency: number | null;
  lastSynced: Date | null;
  isHealthy: boolean;
  isLoading?: boolean;
}

const styles = {
  container:
    'rounded-xl p-3 md:p-4 bg-[var(--accent-primary)]/[0.08] dark:bg-[var(--accent-primary)]/10',
  header: 'flex items-center gap-2 mb-2 md:mb-3',
  headerLabel: 'text-[10px] md:text-xs font-medium text-muted',
  headerSpacer: 'flex-1',
  healthBadgeHealthy:
    'flex items-center gap-1 px-2 py-[2px] md:py-[3px] rounded-[8px] md:rounded-[10px] bg-green-500 dark:bg-green-400',
  healthBadgeDegraded:
    'flex items-center gap-1 px-2 py-[2px] md:py-[3px] rounded-[8px] md:rounded-[10px] bg-amber-500',
  healthDot: 'w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white dark:bg-black',
  healthText:
    'text-[9px] md:text-[10px] font-semibold text-white dark:text-black',
  metricsRow: 'flex gap-3 md:gap-4',
  metricItem: 'flex flex-col gap-0.5 flex-1',
  metricValue: 'text-base md:text-lg font-bold text-default',
  metricValueGreen:
    'text-base md:text-lg font-bold text-green-500 dark:text-green-400',
  metricValueMuted: 'text-base md:text-lg font-bold text-muted',
  metricLabel: 'text-[9px] md:text-[11px] text-gray-400',
  skeleton: 'h-5 md:h-6 w-14 md:w-16 bg-interactive rounded animate-pulse',
} as const;

export const NetworkHealthMetrics: React.FC<NetworkHealthMetricsProps> = ({
  blockHeight,
  latency,
  lastSynced,
  isHealthy,
  isLoading = false,
}) => {
  const relativeTime = useMemo(
    () => formatRelativeTime(lastSynced),
    [lastSynced]
  );

  const hasData =
    blockHeight !== null || latency !== null || lastSynced !== null;
  if (!hasData && !isLoading) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Network Health</span>
        <div className={styles.headerSpacer} />
        {hasData && !isLoading && (
          <div
            className={
              isHealthy ? styles.healthBadgeHealthy : styles.healthBadgeDegraded
            }
          >
            <div className={styles.healthDot} />
            <span className={styles.healthText}>
              {isHealthy ? 'Healthy' : 'Degraded'}
            </span>
          </div>
        )}
      </div>

      <div className={styles.metricsRow}>
        <div className={styles.metricItem}>
          {isLoading ? (
            <div className={styles.skeleton} />
          ) : (
            <span className={styles.metricValue}>
              {blockHeight !== null ? blockHeight.toLocaleString() : 'N/A'}
            </span>
          )}
          <span className={styles.metricLabel}>Block Height</span>
        </div>

        <div className={styles.metricItem}>
          {isLoading ? (
            <div className={styles.skeleton} />
          ) : (
            <span className={styles.metricValueGreen}>
              {latency !== null ? `${latency}ms` : 'N/A'}
            </span>
          )}
          <span className={styles.metricLabel}>Latency</span>
        </div>

        <div className={styles.metricItem}>
          {isLoading ? (
            <div className={styles.skeleton} />
          ) : (
            <span className={styles.metricValueMuted}>{relativeTime}</span>
          )}
          <span className={styles.metricLabel}>Last Synced</span>
        </div>
      </div>
    </div>
  );
};
