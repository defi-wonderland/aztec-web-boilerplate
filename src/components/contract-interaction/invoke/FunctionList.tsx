import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn, iconSize } from '../../../utils';
import { Input } from '../../ui';
import type { FunctionListProps } from '../types';

/**
 * FunctionList styles - semantic pattern.
 */
const styles = {
  card: 'rounded-lg border border-default bg-surface-secondary p-4 space-y-4',
  // Search input
  searchLabel: 'text-sm font-semibold text-default mb-2 block',
  // Container for groups (no scroll here, each group has its own)
  groupsContainer: 'space-y-4',
  // Groups
  group: 'space-y-2',
  groupHeader: 'space-y-0.5',
  groupLabel: 'text-xs font-semibold text-accent uppercase tracking-wide',
  groupDescription: 'text-xs text-muted',
  // Function list - each group has its own scroll with accent-themed scrollbar
  functionList: 'space-y-1 max-h-64 overflow-y-auto scrollbar-accent',
  functionItem: cn(
    'w-full text-left px-3 py-2 rounded-lg',
    'transition-all duration-200 cursor-pointer',
    'hover:bg-surface-tertiary',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20'
  ),
  functionItemActive: 'bg-accent/5 border border-gray-400 dark:border-gray-600',
  functionItemInactive: 'bg-surface border border-transparent',
  functionName: 'text-sm font-medium text-default block',
  functionMeta: 'text-xs text-muted',
  // Empty state
  emptyState: 'py-8 text-center text-sm text-muted',
  emptyIcon: 'mx-auto mb-2 text-amber-500',
} as const;

const FunctionList = ({
  groups,
  selected,
  onSelect,
  filter,
  onFilterChange,
  contractName,
  hasContract,
}: FunctionListProps) => {
  const title = contractName
    ? `Search functions · ${contractName}`
    : 'Search functions';

  return (
    <div className={styles.card}>
      <div>
        <label htmlFor="function-filter" className={styles.searchLabel}>
          {title}
        </label>
        <Input
          id="function-filter"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Type to filter"
        />
      </div>

      <div className={styles.groupsContainer}>
        {groups.map((group) => {
          const description =
            group.id === 'callable'
              ? 'State-changing calls that submit transactions.'
              : 'Read-only or unconstrained helpers; simulate to preview.';
          return (
            <div className={styles.group} key={group.id}>
              <div className={styles.groupHeader}>
                <div className={styles.groupLabel}>{group.label}</div>
                <div className={styles.groupDescription}>{description}</div>
              </div>
              <div className={styles.functionList}>
                {group.items.map((fn) => {
                  const isActive = selected === fn.name;
                  return (
                    <button
                      key={fn.name}
                      type="button"
                      className={cn(
                        styles.functionItem,
                        isActive
                          ? styles.functionItemActive
                          : styles.functionItemInactive
                      )}
                      onClick={() => onSelect(fn.name)}
                    >
                      <span className={styles.functionName}>{fn.name}</span>
                      <span className={styles.functionMeta}>
                        {fn.attributes.join(' · ') || 'public'}
                      </span>
                    </button>
                  );
                })}
                {group.items.length === 0 && (
                  <div className={styles.emptyState}>
                    No functions in this group.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className={styles.emptyState}>
            <AlertTriangle size={iconSize('md')} className={styles.emptyIcon} />
            {hasContract && 'No functions found for current filter.'}
            {!hasContract && 'Load or select a contract to view its functions.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default FunctionList;
