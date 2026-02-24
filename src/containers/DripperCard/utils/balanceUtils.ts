import type { FormattedBalances } from '../../../hooks/queries/useTokenBalance';
import type { BalanceMetrics } from '../types';

/**
 * Calculate balance metrics from formatted balances
 */
export const calculateBalanceMetrics = (
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
