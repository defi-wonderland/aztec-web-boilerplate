import React from 'react';
import { Info, Shield, Globe } from 'lucide-react';
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { formatPercentage, iconSize } from '../../../utils';
import { styles } from '../styles';
import { BalanceDisplay } from './BalanceDisplay';
import type { BalanceMetrics } from '../types';

interface BalanceSectionProps {
  metrics: BalanceMetrics;
  isLoading: boolean;
  isFetching: boolean;
}

export const BalanceSection: React.FC<BalanceSectionProps> = ({
  metrics,
  isLoading,
  isFetching,
}) => {
  const { privateBalance, publicBalance, totalBalance, privatePercentage } =
    metrics;

  if (isLoading) {
    return (
      <div className={styles.balanceSection}>
        <div className={styles.balanceLoadingContainer}>
          <div className={styles.balanceLoadingSpinner} />
          <span>Loading balance...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.balanceSection}>
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
            {isFetching && (
              <Badge variant="info" className={styles.syncBadge}>
                Syncing
              </Badge>
            )}
          </div>
          <BalanceDisplay
            balance={totalBalance}
            className={styles.totalValue}
          />
        </div>
        <span className={styles.totalUnit}>TST</span>
      </div>

      {/* Private/Public Breakdown */}
      <div className={styles.breakdownRow}>
        {/* Private Balance Box */}
        <div className={styles.balanceBox}>
          <div className={styles.balanceBoxLeft}>
            <Shield
              size={iconSize('md')}
              className={styles.balanceBoxIcon.private}
            />
            <span className={styles.balanceBoxLabel}>Private</span>
          </div>
          <div className={styles.balanceBoxRight}>
            <BalanceDisplay
              balance={privateBalance}
              className={styles.balanceBoxValue}
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
          </div>
        </div>

        {/* Public Balance Box */}
        <div className={styles.balanceBox}>
          <div className={styles.balanceBoxLeft}>
            <Globe
              size={iconSize('md')}
              className={styles.balanceBoxIcon.public}
            />
            <span className={styles.balanceBoxLabel}>Public</span>
          </div>
          <div className={styles.balanceBoxRight}>
            <BalanceDisplay
              balance={publicBalance}
              className={styles.balanceBoxValue}
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
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalBalance > 0n && (
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
