import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { iconSize } from '../../utils';
import type { LogEntry } from './types';

/**
 * LogPanel styles - semantic pattern.
 */
const styles = {
  panel:
    'mt-6 rounded-lg border border-default bg-surface-secondary overflow-hidden',
  header:
    'flex items-center justify-between px-4 py-3 border-b border-default bg-surface-tertiary',
  headerTitle: 'text-sm font-semibold text-default',
  count:
    'px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium',
  entries: 'max-h-64 overflow-y-auto scrollbar-accent',
  entry: 'px-4 py-3 border-b border-default last:border-b-0 flex gap-3',
  entryIcon: {
    base: 'flex-shrink-0 mt-0.5',
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-amber-500',
  },
  entryContent: 'flex-1 min-w-0',
  entryTitle: 'text-sm font-medium text-default',
  entryDetail: 'text-xs text-muted mt-0.5 break-all',
  emptyState: 'px-4 py-8 text-center text-sm text-muted',
} as const;

const getLogIcon = (level: LogEntry['level']) => {
  const baseClass = styles.entryIcon.base;
  switch (level) {
    case 'success':
      return (
        <CheckCircle
          size={iconSize()}
          className={`${baseClass} ${styles.entryIcon.success}`}
        />
      );
    case 'error':
      return (
        <XCircle
          size={iconSize()}
          className={`${baseClass} ${styles.entryIcon.error}`}
        />
      );
    case 'warning':
      return (
        <AlertTriangle
          size={iconSize()}
          className={`${baseClass} ${styles.entryIcon.warning}`}
        />
      );
    default:
      return (
        <Info
          size={iconSize()}
          className={`${baseClass} ${styles.entryIcon.info}`}
        />
      );
  }
};

const LogPanel = ({ logs }: { logs: LogEntry[] }) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h4 className={styles.headerTitle}>Log</h4>
        <span className={styles.count}>{logs.length}</span>
      </div>
      <div className={styles.entries}>
        {logs.map((log) => (
          <div key={log.id} className={styles.entry}>
            {getLogIcon(log.level)}
            <div className={styles.entryContent}>
              <div className={styles.entryTitle}>{log.title}</div>
              {log.detail && (
                <div className={styles.entryDetail}>{log.detail}</div>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className={styles.emptyState}>
            No calls yet. Load an artifact to begin.
          </div>
        )}
      </div>
    </div>
  );
};

export default LogPanel;
