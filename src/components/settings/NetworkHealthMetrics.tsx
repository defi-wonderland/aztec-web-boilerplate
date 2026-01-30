import React, { useMemo } from 'react';

export interface NetworkHealthMetricsProps {
  blockHeight: number | null;
  latency: number | null;
  lastSynced: Date | null;
  isHealthy: boolean;
  isLoading?: boolean;
}

const styles = {
  container: 'rounded-xl p-4 bg-[#8B5CF6]/[0.08] dark:bg-[#a78bfa]/10',
  header: 'flex items-center gap-2 mb-3',
  headerLabel: 'text-xs font-medium text-[#6B7280] dark:text-[#9ca3af]',
  headerSpacer: 'flex-1',
  healthBadgeHealthy:
    'flex items-center gap-1 px-2 py-[3px] rounded-[10px] bg-[#22C55E] dark:bg-[#4ade80]',
  healthBadgeDegraded:
    'flex items-center gap-1 px-2 py-[3px] rounded-[10px] bg-[#F59E0B]',
  healthDot: 'w-1.5 h-1.5 rounded-full bg-white dark:bg-black',
  healthText: 'text-[10px] font-semibold text-white dark:text-black',
  metricsRow: 'flex gap-4',
  metricItem: 'flex flex-col gap-0.5 flex-1',
  metricValue: 'text-lg font-bold text-[#1A1A1A] dark:text-white',
  metricValueGreen: 'text-lg font-bold text-[#22C55E] dark:text-[#4ade80]',
  metricValueMuted: 'text-lg font-bold text-[#6B7280] dark:text-[#9ca3af]',
  metricLabel: 'text-[11px] text-[#9CA3AF]',
  skeleton: 'h-6 w-16 bg-[#F3F4F6] dark:bg-[#3a3a44] rounded animate-pulse',
} as const;

/**
 * Format a relative time string (e.g., "2s ago", "1m ago")
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'N/A';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'Now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

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
