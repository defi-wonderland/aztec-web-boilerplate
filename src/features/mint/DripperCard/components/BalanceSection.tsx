import React from 'react';
import { Info, Shield, Globe } from 'lucide-react';
import {
  Badge,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../components/ui';
import { cn, formatPercentage, iconSize } from '../../../../utils';
import { styles } from '../styles';
import { BalanceDisplay } from './BalanceDisplay';
import type { BalanceMetrics } from '../types';

interface BalanceSectionProps {
  metrics: BalanceMetrics;
  isLoading: boolean;
  isFetching: boolean;
  isConnected: boolean;
}

export const BalanceSection: React.FC<BalanceSectionProps> = ({
  metrics,
  isLoading,
  isFetching,
  isConnected,
}) => {
  const { privateBalance, publicBalance, totalBalance, privatePercentage } =
    metrics;

  const showSkeleton = !isConnected || isLoading;
  const skeletonPulse = isConnected && isLoading;

  return (
    <div className={styles.balanceSection} data-testid="token-balance-card">
      {/* Total Balance Row */}
      <div className={styles.totalRow}>
        <div className={styles.totalLeft}>
          <div className={styles.totalLabelRow}>
            <span className={styles.totalLabel}>Total Balance</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={iconSize('xs')} className={styles.totalInfoIcon} />
              </TooltipTrigger>
              <TooltipContent>
                Large numbers are abbreviated (M = Million, B = Billion, T =
                Trillion, Q = Quadrillion). Hover on values to see the full
                amount.
              </TooltipContent>
            </Tooltip>
            {isConnected && isFetching && !isLoading && (
              <Badge
                variant="info"
                className={styles.syncBadge}
                data-testid="balance-syncing"
              >
                Syncing
              </Badge>
            )}
          </div>
          {showSkeleton && (
            <Skeleton
              className={cn(
                styles.skeleton.totalValue,
                skeletonPulse && 'animate-pulse'
              )}
            />
          )}
          {!showSkeleton && (
            <BalanceDisplay
              balance={totalBalance}
              className={styles.totalValue}
            />
          )}
        </div>
        {showSkeleton && (
          <Skeleton
            className={cn(
              styles.skeleton.totalUnit,
              skeletonPulse && 'animate-pulse'
            )}
          />
        )}
        {!showSkeleton && <span className={styles.totalUnit}>TST</span>}
      </div>

      {/* Private/Public Breakdown */}
      <div className={styles.breakdownRow}>
        {/* Private Balance Box */}
        <div className={styles.balanceBox} data-testid="balance-item-private">
          <div className={styles.balanceBoxLeft}>
            <Shield
              size={iconSize('md')}
              className={styles.balanceBoxIcon.private}
            />
            <span className={styles.balanceBoxLabel}>Private</span>
          </div>
          <div className={styles.balanceBoxRight}>
            {showSkeleton && (
              <Skeleton
                className={cn(
                  styles.skeleton.balanceValue,
                  skeletonPulse && 'animate-pulse'
                )}
              />
            )}
            {!showSkeleton && (
              <>
                <BalanceDisplay
                  balance={privateBalance}
                  className={styles.balanceBoxValue}
                  data-testid="balance-value-private"
                />
                {totalBalance > 0n && (
                  <span className={styles.balanceBoxPercent.private}>
                    {formatPercentage(
                      metrics.privatePercentage,
                      privateBalance,
                      totalBalance
                    )}
                    %
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Public Balance Box */}
        <div className={styles.balanceBox} data-testid="balance-item-public">
          <div className={styles.balanceBoxLeft}>
            <Globe
              size={iconSize('md')}
              className={styles.balanceBoxIcon.public}
            />
            <span className={styles.balanceBoxLabel}>Public</span>
          </div>
          <div className={styles.balanceBoxRight}>
            {showSkeleton && (
              <Skeleton
                className={cn(
                  styles.skeleton.balanceValue,
                  skeletonPulse && 'animate-pulse'
                )}
              />
            )}
            {!showSkeleton && (
              <>
                <BalanceDisplay
                  balance={publicBalance}
                  className={styles.balanceBoxValue}
                  data-testid="balance-value-public"
                />
                {totalBalance > 0n && (
                  <span className={styles.balanceBoxPercent.public}>
                    {formatPercentage(
                      metrics.publicPercentage,
                      publicBalance,
                      totalBalance
                    )}
                    %
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {showSkeleton && (
        <Skeleton
          className={cn(
            styles.skeleton.progressBar,
            skeletonPulse && 'animate-pulse'
          )}
        />
      )}
      {!showSkeleton && totalBalance > 0n && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${privatePercentage}%` }}
          />
        </div>
      )}
    </div>
  );
};
