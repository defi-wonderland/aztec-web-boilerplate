import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn, iconSize } from '../../../utils';
import { Button, Badge } from '../../ui';
import type { SavedContractsListProps } from '../types';

const styles = {
  section: 'flex flex-col gap-3 pt-4 border-t border-default',
  header: 'flex items-center justify-between',
  label: 'text-sm font-semibold text-default',
  contractsList: 'flex flex-col gap-2',
  card: {
    base: 'flex items-center justify-between gap-4 p-3 rounded-lg border transition-colors',
    active: 'bg-accent/5 border-gray-400 dark:border-gray-600',
    inactive: 'bg-surface-secondary border-default hover:border-accent/20',
  },
  contractInfo: 'flex flex-col gap-0.5 min-w-0 flex-1',
  contractTitle: 'flex items-center gap-2',
  contractName: 'text-sm font-medium text-default truncate',
  contractAddress: 'text-xs text-muted font-mono truncate',
  contractMeta: 'text-xs text-muted',
  actions: 'flex gap-2 shrink-0',
} as const;

const SavedContractsList: React.FC<SavedContractsListProps> = ({
  contracts,
  activeAddress,
  onApply,
  onDelete,
  onClearAll,
  canClear,
}) => {
  const normalizedActiveAddress = activeAddress.trim().toLowerCase();

  if (contracts.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <label className={styles.label}>Saved contracts</label>
        <Button
          variant="danger"
          size="sm"
          onClick={onClearAll}
          disabled={!canClear}
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
                styles.card.base,
                isActive ? styles.card.active : styles.card.inactive
              )}
              key={contract.address}
            >
              <div className={styles.contractInfo}>
                <div className={styles.contractTitle}>
                  <span className={styles.contractName}>
                    {contract.label ?? 'Saved contract'}
                  </span>
                  {isActive && <Badge variant="primary">Active</Badge>}
                </div>
                <span className={styles.contractAddress}>
                  {contract.address}
                </span>
                <span className={styles.contractMeta}>
                  {contract.artifact || contract.artifactKey
                    ? 'Artifact cached'
                    : 'Address only'}
                </span>
              </div>

              <div className={styles.actions}>
                <Button
                  variant={isActive ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => onApply(contract)}
                  disabled={isActive}
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
          );
        })}
      </div>
    </div>
  );
};

export default SavedContractsList;
