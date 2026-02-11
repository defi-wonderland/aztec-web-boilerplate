import React, { useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '../../../../hooks';
import { cn, iconSize } from '../../../../utils';
import { formatDisplayValue, formatRelativeTime } from './explorer-utils';
import type { SimulationResult } from '../../../../store';

interface SimulationResultCardProps {
  simulationResult: SimulationResult;
}

const styles = {
  resultCard: cn(
    'flex flex-col gap-4',
    'p-5 rounded-2xl',
    'bg-success-container border border-success-soft'
  ),
  resultHeader: 'flex items-center justify-between w-full',
  resultHeaderLeft: 'flex items-center gap-3',
  resultDot: 'w-2.5 h-2.5 rounded-full bg-success-soft',
  resultTitle: 'text-sm font-semibold text-success',
  resultTimestamp: 'text-xs text-muted',
  resultValueBox: cn(
    'flex flex-col gap-2',
    'p-5 rounded-xl',
    'bg-surface border border-default'
  ),
  resultValueLabel: cn(
    'text-[11px] font-semibold text-muted',
    'uppercase tracking-wide'
  ),
  resultValueRow: 'flex items-center justify-between w-full',
  resultValue: 'text-[28px] font-bold text-default font-mono',
  resultCopyBtn: cn(
    'flex items-center justify-center',
    'w-8 h-8 rounded-lg',
    'bg-surface-tertiary hover:bg-surface-secondary',
    'transition-colors cursor-pointer'
  ),
  resultCopyIcon: 'text-muted',
  resultType: 'flex items-center gap-2',
  resultTypeLabel: 'text-xs text-muted',
  resultTypeBadge: cn(
    'px-2 py-0.5 rounded',
    'bg-surface-tertiary',
    'text-[11px] font-semibold text-muted font-mono'
  ),
} as const;

export const SimulationResultCard: React.FC<SimulationResultCardProps> = ({
  simulationResult,
}) => {
  const { copied: resultCopied, copy } = useCopyToClipboard();

  const handleCopyResult = useCallback(() => {
    if (simulationResult.value) {
      copy(formatDisplayValue(simulationResult.value));
    }
  }, [simulationResult, copy]);

  return (
    <div className={styles.resultCard}>
      <div className={styles.resultHeader}>
        <div className={styles.resultHeaderLeft}>
          <div className={styles.resultDot} />
          <span className={styles.resultTitle}>Simulation Result</span>
        </div>
        <span className={styles.resultTimestamp}>
          {formatRelativeTime(simulationResult.timestamp)}
        </span>
      </div>
      <div className={styles.resultValueBox}>
        <span className={styles.resultValueLabel}>Return Value</span>
        <div className={styles.resultValueRow}>
          <span className={styles.resultValue}>
            {formatDisplayValue(simulationResult.value)}
          </span>
          <button
            type="button"
            className={cn(styles.resultCopyBtn, resultCopied && 'text-success')}
            onClick={handleCopyResult}
            aria-label="Copy value"
          >
            {resultCopied ? (
              <Check size={iconSize()} />
            ) : (
              <Copy size={iconSize()} className={styles.resultCopyIcon} />
            )}
          </button>
        </div>
        <div className={styles.resultType}>
          <span className={styles.resultTypeLabel}>Type:</span>
          <span className={styles.resultTypeBadge}>
            {simulationResult.type}
          </span>
        </div>
      </div>
    </div>
  );
};
