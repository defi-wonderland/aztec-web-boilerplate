import React from 'react';
import { Plus, Wallet } from 'lucide-react';
import { useConnectModal } from '../../../aztec-wallet';
import { cn, iconSize } from '../../../utils';
import { Button, Card, CardContent, Skeleton } from '../../ui';

const styles = {
  // Layout
  layout: cn('flex w-full h-[calc(100vh-72px)]', 'bg-surface-secondary'),

  // === Sidebar ===
  sidebar: cn(
    'flex flex-col w-[280px] min-w-[280px]',
    'bg-surface h-full',
    'border-r border-default'
  ),
  sidebarHeader: cn('px-5 py-4', 'border-b border-default'),
  sidebarTitle: 'text-sm font-bold text-default font-display',
  contractsList: cn('flex flex-col gap-1.5', 'flex-1 overflow-hidden', 'p-4'),
  contractItem: cn('flex items-start gap-2.5', 'px-3 py-2.5 rounded-lg'),
  contractIcon: 'w-[18px] h-[18px] flex-shrink-0 mt-[3px]',
  contractInfo: 'flex flex-col gap-1 flex-1 min-w-0',
  addContractBtn: cn(
    'flex items-center gap-2',
    'px-3 py-2.5 rounded-lg',
    'opacity-50 cursor-default'
  ),
  addContractIcon: 'text-accent',
  addContractText: 'text-[13px] font-semibold text-default',

  // === Main panel skeleton ===
  main: 'flex-1 relative overflow-hidden',
  explorerSkeleton: cn(
    'flex flex-col gap-6 p-8',
    'opacity-[0.35] pointer-events-none select-none'
  ),

  // Function header
  headerSection: 'flex flex-col gap-2',
  breadcrumbRow: 'flex items-center gap-1.5',
  titleAndBadge: 'flex items-center justify-between mt-1',
  badge: cn('h-7 w-20 rounded-full', 'bg-amber-500 opacity-10'),

  // Parameters card
  paramsCard: cn(
    'rounded-2xl border border-default bg-surface',
    'overflow-hidden'
  ),
  paramsHeader: cn(
    'flex items-center gap-2',
    'px-5 py-4 border-b border-default'
  ),
  paramsBody: 'p-5 flex flex-col gap-5',
  paramRow: 'flex flex-col gap-2',
  paramLabelRow: 'flex items-center justify-between',
  paramInputRow: 'flex items-center gap-3',
  paramInput: cn(
    'flex-1 h-10 rounded-[10px]',
    'border border-default bg-surface-tertiary'
  ),
  paramHelper: cn('h-10 w-20 rounded-lg', 'bg-surface-tertiary'),

  // Action buttons
  actions: 'flex items-center gap-4 pt-2',
  simulateBtn: cn('h-14 w-64 rounded-2xl', 'border border-default bg-surface'),
  executeBtn: cn('h-14 w-80 rounded-2xl', 'bg-surface-tertiary'),

  // Execution history
  historyCard: cn(
    'rounded-2xl border border-default bg-surface',
    'overflow-hidden'
  ),
  historyHeader: cn(
    'flex items-center gap-2',
    'px-5 py-3.5 border-b border-default'
  ),
  historyBody: 'px-5 py-8 flex items-center justify-center',

  // Connect wallet overlay
  overlay: cn(
    'absolute inset-0',
    'flex items-center justify-center',
    'bg-surface-secondary/60 backdrop-blur-[2px]'
  ),
  overlayCard: 'max-w-sm w-full',
  overlayCardContent: cn(
    'flex flex-col items-center text-center',
    'py-10 px-6 gap-4'
  ),
  overlayIcon: 'text-accent',
  overlayTitle: 'text-lg font-semibold text-default',
  overlayDescription: 'text-sm text-muted',
} as const;

/** Skeleton contract items: name width + address width */
const SKELETON_CONTRACTS = [
  { nameW: 'w-14', addrW: 'w-28' },
  { nameW: 'w-20', addrW: 'w-24' },
  { nameW: 'w-24', addrW: 'w-28' },
];

/** Parameter input widths for variety */
const PARAM_ROWS = [
  { labelW: 'w-10', typeW: 'w-20', hasHelper: true },
  { labelW: 'w-7', typeW: 'w-20', hasHelper: true },
  { labelW: 'w-12', typeW: 'w-8', hasHelper: false },
  { labelW: 'w-12', typeW: 'w-8', hasHelper: false },
];

export const ContractDisconnectedState: React.FC = () => {
  const { open: openConnectModal } = useConnectModal();

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Header */}
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Contracts</span>
        </div>

        {/* Contract list skeleton */}
        <div className={styles.contractsList}>
          {SKELETON_CONTRACTS.map((item, i) => (
            <div key={i} className={styles.contractItem}>
              <Skeleton className={cn(styles.contractIcon, 'rounded')} />
              <div className={styles.contractInfo}>
                <Skeleton className={cn('h-3.5', item.nameW)} />
                <Skeleton className={cn('h-2.5', item.addrW)} />
              </div>
            </div>
          ))}

          {/* Add Contract button - disabled */}
          <div className={styles.addContractBtn}>
            <Plus size={18} className={styles.addContractIcon} />
            <span className={styles.addContractText}>Add Contract</span>
          </div>
        </div>
      </aside>

      {/* Main panel */}
      <div className={styles.main}>
        {/* Explorer skeleton */}
        <div className={styles.explorerSkeleton}>
          {/* Function header */}
          <div className={styles.headerSection}>
            <div className={styles.breadcrumbRow}>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-1" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className={styles.titleAndBadge}>
              <Skeleton className="h-8 w-64" />
              <div className={styles.badge} />
            </div>
            <Skeleton className="h-3.5 w-96" />
          </div>

          {/* Parameters card */}
          <div className={styles.paramsCard}>
            <div className={styles.paramsHeader}>
              <Skeleton className="w-3.5 h-3.5 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className={styles.paramsBody}>
              {PARAM_ROWS.map((param, i) => (
                <div key={i} className={styles.paramRow}>
                  <div className={styles.paramLabelRow}>
                    <Skeleton className={cn('h-3', param.labelW)} />
                    <Skeleton className={cn('h-3', param.typeW)} />
                  </div>
                  <div className={styles.paramInputRow}>
                    <div className={styles.paramInput} />
                    {param.hasHelper && <div className={styles.paramHelper} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            <div className={styles.simulateBtn} />
            <div className={styles.executeBtn} />
          </div>

          {/* Execution history */}
          <div className={styles.historyCard}>
            <div className={styles.historyHeader}>
              <Skeleton className="w-4 h-4 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className={styles.historyBody}>
              <Skeleton className="h-3.5 w-40" />
            </div>
          </div>
        </div>

        {/* Connect wallet overlay */}
        <div className={styles.overlay}>
          <Card className={styles.overlayCard}>
            <CardContent className={styles.overlayCardContent}>
              <Wallet size={iconSize('xl')} className={styles.overlayIcon} />
              <h3 className={styles.overlayTitle}>Connect Your Wallet</h3>
              <p className={styles.overlayDescription}>
                Connect a wallet to load, deploy, and interact with smart
                contracts
              </p>
              <Button
                variant="primary"
                onClick={openConnectModal}
                icon={<Wallet size={iconSize()} />}
              >
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
