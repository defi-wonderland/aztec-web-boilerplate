import React from 'react';
import { Circle } from 'lucide-react';
import { cn, toTitleCase, iconSize } from '../../../../../utils';
import { useInvokeFlowData } from '../../../store';
import type { ParsedFunction } from '../../../../../types';

interface FunctionHeaderProps {
  selectedFn: ParsedFunction;
  isPrivate: boolean;
}

const styles = {
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
} as const;

export const FunctionHeader: React.FC<FunctionHeaderProps> = ({
  selectedFn,
  isPrivate,
}) => {
  const { contractName } = useInvokeFlowData();

  return (
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
        <h1 className={styles.functionTitle}>{toTitleCase(selectedFn.name)}</h1>
        <div
          className={cn(
            styles.badge,
            isPrivate ? styles.badgePrivate : styles.badgePublic
          )}
        >
          <Circle
            size={iconSize('xxs')}
            fill="currentColor"
            className={styles.badgeIcon}
          />
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
  );
};
