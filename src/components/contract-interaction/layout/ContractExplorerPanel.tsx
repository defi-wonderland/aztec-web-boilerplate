import React, { useCallback, useMemo } from 'react';
import {
  Play,
  Zap,
  Copy,
  Clock,
  Circle,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Check,
} from 'lucide-react';
import {
  useFormValues,
  useFormActions,
  type SimulationResult,
} from '../../../store';
import { ParsedFunction } from '../../../types';
import { cn, iconSize, toTitleCase } from '../../../utils';
import {
  analyzeFunctionCapabilities,
  formatParsedType,
} from '../../../utils/contractInteraction';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/Dialog';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { LogEntry, FunctionGroup } from '../types';

/**
 * Attempt to prettify a JSON string with indentation.
 * Returns the original string if parsing fails.
 */
const prettifyJson = (str: string): string => {
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
};

/**
 * Format a simulation result value for display.
 * Parses JSON and returns the actual value without extra quotes for primitives.
 */
const formatDisplayValue = (value: string): string => {
  try {
    const parsed = JSON.parse(value);
    // For primitives (string, number, boolean), return the value directly
    if (
      typeof parsed === 'string' ||
      typeof parsed === 'number' ||
      typeof parsed === 'boolean'
    ) {
      return String(parsed);
    }
    // For objects/arrays, return pretty-printed JSON
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
};

/**
 * Pixel-perfect styles matching Pencil design "Contracts UI V2 - Light"
 */
const styles = {
  // Main panel container - scrollable with proper flex
  panel: cn(
    'flex flex-col gap-6',
    'p-8 flex-1 min-h-0 overflow-y-auto',
    'bg-surface-secondary',
    'scrollbar-accent'
  ),

  // === Empty state ===
  emptyState: cn(
    'flex flex-col items-center justify-center',
    'flex-1 py-16 text-center'
  ),
  emptyTitle: 'text-lg font-semibold text-default mb-2',
  emptyText: 'text-sm text-muted max-w-md',

  // === Function Header ===
  functionHeader: 'flex flex-col gap-2 w-full',

  // Breadcrumb
  breadcrumb: 'flex items-center gap-2',
  breadcrumbContract: 'text-xs font-medium text-muted',
  breadcrumbSlash: 'text-xs text-muted',
  breadcrumbFunction: 'text-xs font-semibold text-accent font-mono',

  // Title row
  titleRow: 'flex items-center justify-between w-full',
  functionTitle: 'text-2xl font-bold text-default font-display',

  // Badge
  badge: cn('flex items-center gap-1.5', 'px-3 py-1.5 rounded-full'),
  badgePublic: 'bg-success-soft text-success',
  badgePrivate: 'bg-warning-soft text-warning',
  badgeIcon: '',
  badgeText: 'text-xs font-medium',

  // Description
  description: 'text-sm text-muted leading-relaxed',

  // === Parameters Accordion ===
  accordion: cn(
    'flex flex-col flex-shrink-0',
    'rounded-2xl overflow-hidden',
    'bg-surface border border-default'
  ),
  accordionHeader: cn(
    'flex items-center justify-between',
    'px-5 py-4',
    'border-b border-default'
  ),
  accordionHeaderLeft: 'flex items-center gap-2.5',
  accordionIcon: 'text-accent',
  accordionTitle: 'text-sm font-semibold text-default',
  accordionCount: cn(
    'px-2 py-0.5 rounded-full',
    'bg-surface-tertiary',
    'text-[11px] font-medium text-muted'
  ),
  accordionChevron: 'text-muted',
  accordionContent: cn(
    'flex flex-col gap-5 p-5',
    'max-h-[400px] overflow-y-auto',
    'scrollbar-accent'
  ),

  // Parameter input
  paramGroup: 'flex flex-col gap-2 w-full',
  paramHeader: 'flex items-center justify-between w-full',
  paramLeft: 'flex items-center gap-2',
  paramLabel: 'text-sm font-medium text-default',
  paramRequired: 'text-error',
  paramType: 'text-xs font-mono text-muted',
  paramInputWrapper: 'flex items-center gap-2 w-full',
  paramInput: cn(
    'flex-1 h-12 px-4 rounded-[10px]',
    'bg-surface border border-default',
    'text-[13px] font-mono text-default',
    'placeholder:text-muted',
    'focus:outline-none focus:border-accent focus:border-2',
    'transition-colors'
  ),
  paramInputError: 'border-error border-2 bg-error-soft',
  paramHelper: cn(
    'flex items-center gap-1.5',
    'px-3 py-2.5 rounded-lg',
    'bg-accent/10',
    'cursor-pointer hover:bg-accent/15 transition-colors'
  ),
  paramHelperText: 'text-xs font-medium text-accent',
  paramError: 'flex items-center gap-1.5 mt-1',
  paramErrorIcon: 'text-error',
  paramErrorText: 'text-xs text-error',

  // === Actions Row ===
  actionsRow: cn('flex items-center gap-4', 'pt-5'),
  simulateBtn: cn(
    'flex items-center justify-center gap-2.5',
    'w-[260px] h-[54px] rounded-[14px]',
    'bg-surface border-2 border-default',
    'text-[15px] font-bold text-default',
    'hover:bg-surface-secondary transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ),
  executeBtn: cn(
    'flex items-center justify-center gap-2.5',
    'w-[340px] h-[54px] rounded-[14px]',
    'bg-accent text-white',
    'text-[15px] font-bold cursor-pointer',
    'hover:brightness-110 hover:shadow-lg transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ),

  // === Simulation Result Card ===
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

  // === Execution History Card ===
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
  historyEntryError: 'bg-transparent',
  entryLeft: 'flex flex-col gap-1 w-[72px] flex-shrink-0',
  entryTime: 'text-[11px] font-semibold text-muted font-mono',
  entryDate: 'text-[10px] text-muted',
  entryContent: 'flex flex-col gap-1.5 flex-1 min-w-0',
  entryHeader: 'flex items-center gap-2 flex-wrap',
  entryStatus: cn('px-2 py-0.5 rounded', 'text-[10px] font-semibold'),
  entryStatusSuccess: 'bg-success-soft text-success',
  entryStatusError: 'bg-error-soft text-error',
  entryFn: 'text-xs font-semibold text-default font-mono',
  entryType: 'text-[11px] text-muted',
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
} as const;

interface ContractExplorerPanelProps {
  networkName?: AztecNetwork;
  connectedAddress: string;
  contractName?: string;
  groups: FunctionGroup[];
  selectedFunctionName: string | null;
  simulationResult: SimulationResult | null;
  logs: LogEntry[];
  status: 'idle' | 'simulating' | 'executing';
  error: string | null;
  onSimulate: (functionName: string) => void;
  onExecute: (functionName: string) => void;
  onClearLogs: () => void;
}

// Threshold for showing expand toggle (characters)
const DETAIL_TRUNCATE_THRESHOLD = 120;

export const ContractExplorerPanel: React.FC<ContractExplorerPanelProps> = ({
  connectedAddress,
  contractName,
  groups,
  selectedFunctionName,
  simulationResult,
  logs,
  status,
  error: _error,
  onSimulate,
  onExecute,
  onClearLogs,
}) => {
  const formValues = useFormValues();
  const { setValue: setFormValue } = useFormActions();

  // Track expanded log entries
  const [expandedLogs, setExpandedLogs] = React.useState<Set<string>>(
    new Set()
  );

  // Modal state for full log view
  const [modalLog, setModalLog] = React.useState<LogEntry | null>(null);
  const [copySuccess, setCopySuccess] = React.useState(false);

  // Track simulation result copy success
  const [resultCopied, setResultCopied] = React.useState(false);

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
    setCopySuccess(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalLog(null);
    setCopySuccess(false);
  }, []);

  const handleCopyLogDetail = useCallback(async () => {
    if (!modalLog?.detail) return;
    try {
      await navigator.clipboard.writeText(prettifyJson(modalLog.detail));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Clipboard API failed silently
    }
  }, [modalLog]);

  // Find the selected function
  const selectedFn = useMemo((): ParsedFunction | null => {
    if (!selectedFunctionName) return null;
    for (const group of groups) {
      const fn = group.items.find((f) => f.name === selectedFunctionName);
      if (fn) return fn;
    }
    return null;
  }, [groups, selectedFunctionName]);

  // Analyze function capabilities
  const capabilities = useMemo(
    () =>
      analyzeFunctionCapabilities(
        selectedFn?.attributes ?? [],
        selectedFn?.inputs
      ),
    [selectedFn]
  );

  const isBusy = status !== 'idle';
  const isSimulating = status === 'simulating';
  const isExecuting = status === 'executing';

  const simulateDisabled = !selectedFn || isBusy || !capabilities.canSimulate;
  const executeDisabled = !selectedFn || isBusy || !capabilities.isExecutable;

  // Handlers
  const handleFormValueChange = useCallback(
    (path: string, value: string) => {
      setFormValue(path, value);
    },
    [setFormValue]
  );

  const handleSimulate = useCallback(() => {
    if (selectedFunctionName) {
      onSimulate(selectedFunctionName);
    }
  }, [selectedFunctionName, onSimulate]);

  const handleExecute = useCallback(() => {
    if (selectedFunctionName) {
      onExecute(selectedFunctionName);
    }
  }, [selectedFunctionName, onExecute]);

  const handleCopyResult = useCallback(async () => {
    if (!simulationResult?.value) return;
    try {
      await navigator.clipboard.writeText(
        formatDisplayValue(simulationResult.value)
      );
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      // Clipboard API failed silently
    }
  }, [simulationResult]);

  // Format timestamp for display
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
    return 'Today';
  };

  // If no function selected, show empty state
  if (!selectedFn) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>Select a Function</h3>
          <p className={styles.emptyText}>
            Choose a function from the sidebar to view its parameters, simulate
            calls, or execute transactions.
          </p>
        </div>
      </div>
    );
  }

  const isPrivate = capabilities.isPrivate;
  const requiredCount = selectedFn.inputs.filter(
    (input) => !input.path.includes('?')
  ).length;

  return (
    <div className={styles.panel}>
      {/* Function Header */}
      <div className={styles.functionHeader}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbContract}>
            {contractName ?? 'Contract'}
          </span>
          <span className={styles.breadcrumbSlash}>/</span>
          <span className={styles.breadcrumbFunction}>{selectedFn.name}</span>
        </div>

        {/* Title Row */}
        <div className={styles.titleRow}>
          <h1 className={styles.functionTitle}>
            {toTitleCase(selectedFn.name)}
          </h1>
          <div
            className={cn(
              styles.badge,
              isPrivate ? styles.badgePrivate : styles.badgePublic
            )}
          >
            <Circle size={8} fill="currentColor" className={styles.badgeIcon} />
            <span className={styles.badgeText}>
              {isPrivate ? 'Private' : 'Public'}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className={styles.description}>
          {isPrivate
            ? 'Private function that operates on private state. Results can only be proven by the note owner.'
            : 'Public function that modifies or reads public state. Requires sufficient balance and valid addresses.'}
        </p>
      </div>

      {/* Parameters Accordion */}
      <div className={styles.accordion}>
        <div className={styles.accordionHeader}>
          <div className={styles.accordionHeaderLeft}>
            <Circle
              size={iconSize()}
              className={styles.accordionIcon}
              fill="currentColor"
            />
            <span className={styles.accordionTitle}>Parameters</span>
            <span className={styles.accordionCount}>
              {requiredCount} required
            </span>
          </div>
        </div>
        <div className={styles.accordionContent}>
          {selectedFn.inputs.length === 0 ? (
            <p className="text-sm text-muted">
              This function has no parameters. Click Simulate or Execute to run
              it.
            </p>
          ) : (
            selectedFn.inputs.map((input) => {
              const value = formValues[input.path] ?? '';
              const isRequired = !input.path.includes('?');

              return (
                <div key={input.path} className={styles.paramGroup}>
                  <div className={styles.paramHeader}>
                    <div className={styles.paramLeft}>
                      <span className={styles.paramLabel}>
                        {toTitleCase(input.path)}
                        {isRequired && (
                          <span className={styles.paramRequired}> *</span>
                        )}
                      </span>
                    </div>
                    <span className={styles.paramType}>
                      {formatParsedType(input.type)}
                    </span>
                  </div>
                  <div className={styles.paramInputWrapper}>
                    <input
                      type="text"
                      className={styles.paramInput}
                      value={value}
                      onChange={(e) =>
                        handleFormValueChange(input.path, e.target.value)
                      }
                      placeholder={`Enter ${toTitleCase(input.path)} value...`}
                      disabled={isBusy}
                    />
                    {input.path === 'from' && connectedAddress && (
                      <button
                        type="button"
                        className={styles.paramHelper}
                        onClick={() =>
                          handleFormValueChange(input.path, connectedAddress)
                        }
                      >
                        <span className={styles.paramHelperText}>
                          Use wallet
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Actions Row */}
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.simulateBtn}
          disabled={simulateDisabled}
          onClick={handleSimulate}
        >
          <Play size={iconSize()} />
          <span>{isSimulating ? 'Simulating...' : 'Simulate'}</span>
        </button>
        <button
          type="button"
          className={styles.executeBtn}
          disabled={executeDisabled}
          onClick={handleExecute}
        >
          <Zap size={iconSize()} />
          <span>{isExecuting ? 'Executing...' : 'Execute'}</span>
        </button>
      </div>

      {/* Simulation Result Card - only show for the function that was simulated */}
      {simulationResult &&
        simulationResult.functionName === selectedFunctionName && (
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
                  className={cn(
                    styles.resultCopyBtn,
                    resultCopied && 'text-success'
                  )}
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
        )}

      {/* Execution History Card */}
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
              onClick={onClearLogs}
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
                  <span className={styles.entryDate}>Today</span>
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
                  {log.detail && (
                    <>
                      {isLongDetail ? (
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
                                  : `→ ${log.detail.slice(0, DETAIL_TRUNCATE_THRESHOLD)}...`}
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
                              {prettifyJson(log.detail)}
                            </div>
                          )}
                        </div>
                      ) : (
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
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted">
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
                {copySuccess ? (
                  <>
                    <Check size={iconSize()} />
                    Copied
                  </>
                ) : (
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
    </div>
  );
};

export default ContractExplorerPanel;
