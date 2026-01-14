import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn, iconSize } from '../../utils';
import { Button, Badge } from '../ui';
import type { SavedContractsListProps } from './types';

/**
 * SavedContractsList styles - semantic pattern.
 */
const styles = {
  container: 'space-y-3 pt-4 border-t border-default',
  header: 'flex items-center justify-between',
  label: 'text-sm font-semibold text-default',
  contractsList: 'space-y-2',
  card: 'p-3 rounded-lg border bg-surface transition-all duration-200',
  cardActive: 'border-accent/50 bg-accent/5',
  cardInactive: 'border-default hover:border-accent/30',
  cardContent: 'flex items-start justify-between gap-3',
  info: 'flex-1 min-w-0',
  titleRow: 'flex items-center gap-2',
  name: 'text-sm font-medium text-default truncate',
  address: 'text-xs font-mono text-muted truncate mt-0.5',
  meta: 'text-xs text-muted mt-1',
  actions: 'flex items-center gap-2 flex-shrink-0',
} as const;

const SavedContractsList = ({
  contracts,
  activeAddress,
  onApply,
  onDelete,
  onClearAll,
  canClear,
}: SavedContractsListProps) => {
  const normalizedActiveAddress = activeAddress.trim().toLowerCase();

  if (contracts.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label className={styles.label}>Saved contracts</label>
        <Button
          variant="danger-outline"
          size="sm"
          onClick={onClearAll}
          disabled={!canClear}
          aria-label="Clear all saved contracts"
          title="Remove all saved contracts from cache"
          icon={<Trash2 size={iconSize()} />}
        >
          Clear all
        </Button>
      </div>
      <div className={styles.contractsList}>
        {contracts.map((contract) => {
          const isActive =
            normalizedActiveAddress === contract.address.trim().toLowerCase();

          return (
            <div
              className={cn(
                styles.card,
                isActive ? styles.cardActive : styles.cardInactive
              )}
              key={contract.address}
            >
              <div className={styles.cardContent}>
                <div className={styles.info}>
                  <div className={styles.titleRow}>
                    <span className={styles.name}>
                      {contract.label ?? 'Saved contract'}
                    </span>
                    {isActive && (
                      <Badge variant="primary" aria-label="Active contract">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className={styles.address}>{contract.address}</div>
                  <div className={styles.meta}>
                    {contract.artifact || contract.artifactKey
                      ? 'Artifact cached'
                      : 'Address only'}
                  </div>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onApply(contract)}
                    disabled={isActive}
                    aria-pressed={isActive}
                  >
                    {isActive ? 'Active' : 'Use'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onDelete(contract.address)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavedContractsList;
