import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../../../components/ui';
import { useCopyToClipboard } from '../../../../../hooks';
import { cn, iconSize, formatRelativeTime } from '../../../../../utils';
import { useSimulationResult } from '../../../store';
import { formatDisplayValue } from './explorer-utils';

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
  resultCopyBtnSuccess: 'text-success',
  // Complex value rendering
  resultValueComplexWrapper: 'flex-1 min-w-0',
  resultValueComplex:
    'text-sm font-mono text-default whitespace-pre-wrap break-all',
  resultValueClamped: 'max-h-40 overflow-auto',
  resultValueExpanded: 'max-h-96 overflow-auto',
  expandToggle: cn(
    'flex items-center gap-1',
    'text-xs text-muted hover:text-default',
    'transition-colors cursor-pointer mt-1'
  ),
  resultType: 'flex items-center gap-2',
  resultTypeLabel: 'text-xs text-muted',
  resultTypeBadge: cn(
    'px-2 py-0.5 rounded',
    'bg-surface-tertiary',
    'text-[11px] font-semibold text-muted font-mono'
  ),
} as const;

interface SimulationResultCardProps {
  selectedFunctionName: string | null;
}

export const SimulationResultCard: React.FC<SimulationResultCardProps> = ({
  selectedFunctionName,
}) => {
  const simulationResult = useSimulationResult();
  const { copied: resultCopied, copy } = useCopyToClipboard();
  const [expanded, setExpanded] = useState(false);

  const formattedValue = useMemo(
    () => (simulationResult ? formatDisplayValue(simulationResult.value) : ''),
    [simulationResult]
  );

  const isComplex = useMemo(
    () => formattedValue.includes('\n') || formattedValue.length > 80,
    [formattedValue]
  );

  const handleCopyResult = useCallback(() => {
    if (simulationResult?.value) {
      copy(formattedValue);
    }
  }, [simulationResult, formattedValue, copy]);

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  if (
    !simulationResult ||
    simulationResult.functionName !== selectedFunctionName
  ) {
    return null;
  }

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
          {!isComplex && (
            <span className={styles.resultValue}>{formattedValue}</span>
          )}
          {isComplex && (
            <div className={styles.resultValueComplexWrapper}>
              <pre
                className={cn(
                  styles.resultValueComplex,
                  expanded && styles.resultValueExpanded,
                  !expanded && styles.resultValueClamped
                )}
              >
                {formattedValue}
              </pre>
              <button
                className={styles.expandToggle}
                onClick={toggleExpanded}
                type="button"
              >
                {expanded && (
                  <>
                    <ChevronUp size={iconSize('xs')} />
                    Show less
                  </>
                )}
                {!expanded && (
                  <>
                    <ChevronDown size={iconSize('xs')} />
                    Show more
                  </>
                )}
              </button>
            </div>
          )}
          <Button
            variant="icon"
            size="icon"
            className={cn(
              styles.resultCopyBtn,
              resultCopied && styles.resultCopyBtnSuccess
            )}
            onClick={handleCopyResult}
            aria-label="Copy value"
          >
            {resultCopied && <Check size={iconSize()} />}
            {!resultCopied && (
              <Copy size={iconSize()} className={styles.resultCopyIcon} />
            )}
          </Button>
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
