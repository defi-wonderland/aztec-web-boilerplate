import React, { useCallback, useMemo } from 'react';
import { Play, Zap } from 'lucide-react';
import { useSelectedFunctionName } from '../../../store';
import { cn, iconSize } from '../../../utils';
import { analyzeFunctionCapabilities } from '../../../utils/contractInteraction';
import { Button } from '../../ui';
import { ExecutionHistoryCard } from './explorer/ExecutionHistoryCard';
import { FunctionHeader } from './explorer/FunctionHeader';
import { ParametersAccordion } from './explorer/ParametersAccordion';
import { SimulationResultCard } from './explorer/SimulationResultCard';
import type { InvokeStatus, FunctionGroup } from '../types';

const styles = {
  // Main panel container - scrollable with proper flex
  panel: cn(
    'flex flex-col gap-6',
    'p-8 flex-1 min-h-0 overflow-y-auto',
    'bg-surface-secondary',
    'scrollbar-accent'
  ),

  // Empty state
  emptyState: cn(
    'flex flex-col items-center justify-center',
    'flex-1 py-16 text-center'
  ),
  emptyTitle: 'text-lg font-semibold text-default mb-2',
  emptyText: 'text-sm text-muted max-w-md',

  // Actions Row
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
} as const;

interface ContractExplorerPanelProps {
  connectedAddress: string;
  groups: FunctionGroup[];
  status: InvokeStatus;
  onSimulate: (functionName: string) => void;
  onExecute: (functionName: string) => void;
}

export const ContractExplorerPanel: React.FC<ContractExplorerPanelProps> = ({
  connectedAddress,
  groups,
  status,
  onSimulate,
  onExecute,
}) => {
  const selectedFunctionName = useSelectedFunctionName();

  // Find the selected function
  const selectedFn = useMemo(() => {
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
  const simulateLabel = status === 'simulating' ? 'Simulating...' : 'Simulate';
  const executeLabel = status === 'executing' ? 'Executing...' : 'Execute';

  const simulateDisabled = !selectedFn || isBusy || !capabilities.canSimulate;
  const executeDisabled = !selectedFn || isBusy || !capabilities.isExecutable;

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

  // Empty state
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

  return (
    <div className={styles.panel}>
      <FunctionHeader
        selectedFn={selectedFn}
        isPrivate={capabilities.isPrivate}
      />

      <ParametersAccordion
        inputs={selectedFn.inputs}
        connectedAddress={connectedAddress}
        isBusy={isBusy}
      />

      {/* Actions Row */}
      <div className={styles.actionsRow}>
        <Button
          variant="secondary"
          className={styles.simulateBtn}
          disabled={simulateDisabled}
          onClick={handleSimulate}
          icon={<Play size={iconSize()} />}
        >
          {simulateLabel}
        </Button>
        <Button
          variant="primary"
          className={styles.executeBtn}
          disabled={executeDisabled}
          onClick={handleExecute}
          icon={<Zap size={iconSize()} />}
        >
          {executeLabel}
        </Button>
      </div>

      <SimulationResultCard selectedFunctionName={selectedFunctionName} />

      <ExecutionHistoryCard />
    </div>
  );
};

export default ContractExplorerPanel;
