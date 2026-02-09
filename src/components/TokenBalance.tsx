import React from 'react';
import { Coins, Shield, Globe } from 'lucide-react';
import {
  useTokenBalance,
  type FormattedBalances,
} from '../hooks/queries/useTokenBalance';
import { iconSize } from '../utils';
import { Card, CardContent, CardTitle, Badge } from './ui';

interface BalanceMetrics {
  privateBalance: bigint;
  publicBalance: bigint;
  totalBalance: bigint;
  privatePercentage: number;
  publicPercentage: number;
}

const styles = {
  // Loading state
  loadingContainer: 'flex items-center justify-center gap-3 py-4 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent',
  // Balance items
  balanceItems: 'flex flex-col gap-3',
  balanceItem: 'flex items-center justify-between',
  balanceLabel: 'flex items-center gap-2 text-secondary',
  balanceValue: 'font-mono font-medium text-default',
  // Balance bar visualization
  balanceVisual: 'mt-4 space-y-2',
  balanceBar: 'h-3 rounded-full bg-surface-tertiary overflow-hidden flex',
  barSegmentPrivate: 'bg-accent h-full transition-all duration-500',
  barSegmentPublic: 'bg-accent-secondary h-full transition-all duration-500',
  percentages: 'flex justify-between text-xs text-muted',
  percentageItem: 'flex items-center gap-1',
  // Total
  totalContainer:
    'mt-4 pt-4 border-t border-default flex items-center justify-between',
  totalLabel: 'text-muted font-medium',
  totalValue: 'text-xl font-bold font-mono text-default',
  // Card customization
  cardWrapper: 'mb-4',
  cardHeader: 'flex items-center justify-between pb-3',
  cardTitle: 'flex items-center gap-2 text-base',
  cardTitleIcon: 'text-accent',
  syncBadge: 'animate-pulse',
} as const;

const calculateBalanceMetrics = (
  formattedBalances: FormattedBalances | null
): BalanceMetrics => {
  const privateBalance = BigInt(formattedBalances?.private ?? '0');
  const publicBalance = BigInt(formattedBalances?.public ?? '0');
  const totalBalance = privateBalance + publicBalance;

  const hasBalance = totalBalance > 0n;
  const calculatePercentage = (balance: bigint) => {
    if (!hasBalance) return 0;
    return Number((balance * 10000n) / totalBalance) / 100;
  };

  const privatePercentage = calculatePercentage(privateBalance);
  const publicPercentage = calculatePercentage(publicBalance);

  return {
    privateBalance,
    publicBalance,
    totalBalance,
    privatePercentage,
    publicPercentage,
  };
};

const LoadingState: React.FC = () => (
  <div className={styles.loadingContainer} data-testid="balance-loading">
    <div className={styles.loadingSpinner} />
    <span>Loading balance...</span>
  </div>
);

const BalanceContent: React.FC<BalanceMetrics> = ({
  privateBalance,
  publicBalance,
  totalBalance,
  privatePercentage,
  publicPercentage,
}) => (
  <>
    <div className={styles.balanceItems}>
      <div className={styles.balanceItem} data-testid="balance-item-private">
        <div className={styles.balanceLabel}>
          <Shield size={iconSize()} />
          <span>Private:</span>
        </div>
        <span
          className={styles.balanceValue}
          data-testid="balance-value-private"
        >
          {privateBalance.toString()}
        </span>
      </div>
      <div className={styles.balanceItem} data-testid="balance-item-public">
        <div className={styles.balanceLabel}>
          <Globe size={iconSize()} />
          <span>Public:</span>
        </div>
        <span
          className={styles.balanceValue}
          data-testid="balance-value-public"
        >
          {publicBalance.toString()}
        </span>
      </div>

      {totalBalance > 0n && (
        <div className={styles.balanceVisual}>
          <div className={styles.balanceBar}>
            {privatePercentage > 0 && (
              <div
                className={styles.barSegmentPrivate}
                style={{ width: `${privatePercentage}%` }}
              />
            )}
            {publicPercentage > 0 && (
              <div
                className={styles.barSegmentPublic}
                style={{ width: `${publicPercentage}%` }}
              />
            )}
          </div>
          <div className={styles.percentages}>
            <span className={styles.percentageItem}>
              <Shield size={iconSize('xs')} /> {privatePercentage.toFixed(0)}%
            </span>
            <span className={styles.percentageItem}>
              <Globe size={iconSize('xs')} /> {publicPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>

    <div className={styles.totalContainer}>
      <span className={styles.totalLabel}>Total:</span>
      <span className={styles.totalValue}>{totalBalance.toString()}</span>
    </div>
  </>
);

export const TokenBalance: React.FC = () => {
  const { formattedBalances, isLoading, isFetching } = useTokenBalance();
  const metrics = calculateBalanceMetrics(formattedBalances);

  return (
    <Card
      padding="sm"
      className={styles.cardWrapper}
      data-testid="token-balance-card"
    >
      <div className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>
          <Coins size={iconSize('md')} className={styles.cardTitleIcon} />
          Your Balance
        </CardTitle>
        {isFetching && !isLoading && (
          <Badge
            variant="info"
            className={styles.syncBadge}
            data-testid="balance-syncing"
          >
            Syncing
          </Badge>
        )}
      </div>
      <CardContent>
        {isLoading ? <LoadingState /> : <BalanceContent {...metrics} />}
      </CardContent>
    </Card>
  );
};
