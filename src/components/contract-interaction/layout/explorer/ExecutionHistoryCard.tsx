import React, { useCallback, useState } from 'react';
import {
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { useCopyToClipboard } from '../../../../hooks';
import { useContractCallLogs, useContractActions } from '../../../../store';
import { cn, iconSize, formatTime, formatDate } from '../../../../utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../ui/Dialog';
import { prettifyJson, DETAIL_TRUNCATE_THRESHOLD } from './explorer-utils';
import type { LogEntry } from '../../types';

const styles = {
  historyCard: cn(
    'flex flex-col flex-shrink-0',
    'rounded-2xl overflow-hidden',
    'bg-surface border border-default'
  ),
  historyHeader: cn(
    'flex items-center justify-between',
    'px-5 py-3.5',
    'border-b border-default'
  ),
  historyHeaderLeft: 'flex items-center gap-2.5',
  historyIcon: 'text-muted',
  historyTitle: 'text-[13px] font-semibold text-default',
  historyCount: cn(
    'px-2 py-0.5 rounded-full',
    'bg-surface-tertiary',
    'text-[11px] font-medium text-muted'
  ),
  historyClear: cn(
    'text-xs font-medium text-accent',
    'cursor-pointer hover:text-accent/80 transition-colors'
  ),
  historyEntries: cn(
    'flex flex-col',
    'max-h-[280px] overflow-y-auto',
    'scrollbar-accent'
  ),

  // History entry
  historyEntry: cn(
    'flex gap-3',
    'px-5 py-3',
    'border-b border-default last:border-b-0'
  ),
  historyEntrySuccess: 'bg-success-soft',
  entryLeft: 'flex flex-col gap-1 w-[72px] flex-shrink-0',
  entryTime: 'text-[11px] font-semibold text-muted font-mono',
  entryDate: 'text-[10px] text-muted',
  entryContent: 'flex flex-col gap-1.5 flex-1 min-w-0',
  entryHeader: 'flex items-center gap-2 flex-wrap',
  entryStatus: cn('px-2 py-0.5 rounded', 'text-[10px] font-semibold'),
  entryStatusSuccess: 'bg-success-soft text-success',
  entryStatusError: 'bg-error-soft text-error',
  entryFn: 'text-xs font-semibold text-default font-mono',
  entryResult: 'text-xs font-mono truncate',
  entryResultSuccess: 'text-success',
  entryResultError: 'text-error',
  entryResultNeutral: 'text-muted',

  // Expandable entry styles
  entryExpandable: '',
  entryExpandRow: 'flex items-center gap-1 cursor-pointer',
  entryExpandIcon: 'flex-shrink-0 text-muted',
  entryExpandText: 'text-xs font-mono truncate flex-1',
  entryExpandActions: 'flex items-center gap-1',
  entryExpandBtn: cn(
    'p-1 rounded',
    'text-muted hover:text-accent',
    'hover:bg-surface-tertiary',
    'transition-colors'
  ),
  entryExpandedContent: cn(
    'mt-2 p-3 rounded-lg',
    'bg-surface-tertiary',
    'text-xs font-mono text-default',
    'whitespace-pre-wrap break-all',
    'max-h-[200px] overflow-y-auto',
    'scrollbar-accent'
  ),

  // Log detail modal styles
  logModalContent: cn(
    'p-4 rounded-lg',
    'bg-surface-tertiary',
    'text-sm font-mono text-default',
    'whitespace-pre-wrap break-all',
    'max-h-[60vh] overflow-y-auto',
    'scrollbar-accent'
  ),
  logModalHeader: 'flex items-center justify-between mb-4 mt-4',
  logModalCopyBtn: cn(
    'flex items-center gap-2',
    'px-3 py-1.5 rounded-lg',
    'bg-surface border border-default',
    'text-sm font-medium text-default',
    'hover:bg-surface-secondary hover:border-accent',
    'transition-colors'
  ),
  logModalCopySuccess: 'text-success border-success',

  // Empty state
  emptyEntries: 'px-5 py-8 text-center text-sm text-muted',
} as const;

export const ExecutionHistoryCard: React.FC = () => {
  const logs = useContractCallLogs();
  const { clearLogs } = useContractActions();

  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [modalLog, setModalLog] = useState<LogEntry | null>(null);
  const { copied: copySuccess, copy } = useCopyToClipboard();

  const toggleLogExpanded = useCallback((logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  const handleOpenModal = useCallback((log: LogEntry) => {
    setModalLog(log);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalLog(null);
  }, []);

  const handleCopyLogDetail = useCallback(() => {
    if (modalLog?.detail) {
      copy(prettifyJson(modalLog.detail));
    }
  }, [modalLog, copy]);

  return (
    <>
      <div className={styles.historyCard}>
        <div className={styles.historyHeader}>
          <div className={styles.historyHeaderLeft}>
            <Clock size={iconSize()} className={styles.historyIcon} />
            <span className={styles.historyTitle}>Execution History</span>
            <span className={styles.historyCount}>
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              className={styles.historyClear}
              onClick={clearLogs}
            >
              Clear all
            </button>
          )}
        </div>
        <div className={styles.historyEntries}>
          {logs.map((log) => {
            const isSuccess = log.level === 'success';
            const isError = log.level === 'error';
            const timestamp = new Date(parseInt(log.id.split('-')[0]));
            const isLongDetail =
              log.detail && log.detail.length > DETAIL_TRUNCATE_THRESHOLD;
            const isExpanded = expandedLogs.has(log.id);
            const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

            return (
              <div
                key={log.id}
                className={cn(
                  styles.historyEntry,
                  isSuccess && styles.historyEntrySuccess
                )}
              >
                <div className={styles.entryLeft}>
                  <span className={styles.entryTime}>
                    {formatTime(timestamp)}
                  </span>
                  <span className={styles.entryDate}>
                    {formatDate(timestamp)}
                  </span>
                </div>
                <div className={styles.entryContent}>
                  <div className={styles.entryHeader}>
                    <span
                      className={cn(
                        styles.entryStatus,
                        isSuccess && styles.entryStatusSuccess,
                        isError && styles.entryStatusError,
                        !isSuccess && !isError && styles.entryStatusSuccess
                      )}
                    >
                      {isSuccess ? 'OK' : isError ? 'ERR' : 'INFO'}
                    </span>
                    <span className={styles.entryFn}>{log.title}</span>
                  </div>
                  {isLongDetail && (
                    <div className={styles.entryExpandable}>
                      <div className={styles.entryExpandActions}>
                        <button
                          type="button"
                          className={styles.entryExpandRow}
                          onClick={() => toggleLogExpanded(log.id)}
                          aria-expanded={isExpanded}
                        >
                          <ChevronIcon
                            size={iconSize('xs')}
                            className={styles.entryExpandIcon}
                          />
                          <span
                            className={cn(
                              styles.entryExpandText,
                              isSuccess && styles.entryResultSuccess,
                              isError && styles.entryResultError,
                              !isSuccess &&
                                !isError &&
                                styles.entryResultNeutral
                            )}
                          >
                            {isExpanded
                              ? '→ Collapse'
                              : `→ ${log.detail!.slice(0, DETAIL_TRUNCATE_THRESHOLD)}...`}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.entryExpandBtn}
                          onClick={() => handleOpenModal(log)}
                          aria-label="Open full view"
                          title="Open full view"
                        >
                          <Maximize2 size={iconSize('xs')} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className={styles.entryExpandedContent}>
                          {prettifyJson(log.detail!)}
                        </div>
                      )}
                    </div>
                  )}
                  {log.detail && !isLongDetail && (
                    <span
                      className={cn(
                        styles.entryResult,
                        isSuccess && styles.entryResultSuccess,
                        isError && styles.entryResultError,
                        !isSuccess && !isError && styles.entryResultNeutral
                      )}
                    >
                      → {log.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className={styles.emptyEntries}>
              No execution history yet. Simulate or execute a function to begin.
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      <Dialog
        open={!!modalLog}
        onOpenChange={(open) => !open && handleCloseModal()}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <div className={styles.logModalHeader}>
              <DialogTitle>{modalLog?.title ?? 'Log Detail'}</DialogTitle>
              <button
                type="button"
                className={cn(
                  styles.logModalCopyBtn,
                  copySuccess && styles.logModalCopySuccess
                )}
                onClick={handleCopyLogDetail}
              >
                {copySuccess && (
                  <>
                    <Check size={iconSize()} />
                    Copied
                  </>
                )}
                {!copySuccess && (
                  <>
                    <Copy size={iconSize()} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </DialogHeader>
          <div className={styles.logModalContent}>
            {modalLog?.detail ? prettifyJson(modalLog.detail) : ''}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
