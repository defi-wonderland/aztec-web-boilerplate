// ============================================================================
// NUMBER FORMATTING UTILITIES
// ============================================================================

interface CompactNumberResult {
  value: string;
  isCompact: boolean;
}

/**
 * Format a number with full precision using locale string
 */
export const formatNumberFull = (value: bigint | number): string => {
  if (typeof value === 'bigint') {
    return value.toLocaleString();
  }
  return value.toLocaleString();
};

/**
 * Compact number formatter with suffix (M, B, T, Q)
 * Only abbreviates numbers >= 1 million
 */
export const formatNumberCompact = (
  value: bigint | number
): CompactNumberResult => {
  const num = typeof value === 'bigint' ? Number(value) : value;

  const suffixes = [
    { threshold: 1e15, suffix: 'Q', divisor: 1e15 }, // Quadrillion
    { threshold: 1e12, suffix: 'T', divisor: 1e12 }, // Trillion
    { threshold: 1e9, suffix: 'B', divisor: 1e9 }, // Billion
    { threshold: 1e6, suffix: 'M', divisor: 1e6 }, // Million
  ];

  for (const { threshold, suffix, divisor } of suffixes) {
    if (num >= threshold) {
      const divided = num / divisor;
      // Show 2 decimal places for cleaner display
      const formatted =
        divided >= 100 ? divided.toFixed(1) : divided.toFixed(2);
      return { value: `${formatted}${suffix}`, isCompact: true };
    }
  }

  return { value: num.toLocaleString(), isCompact: false };
};

/**
 * Format percentage - ensures we don't show 100% unless it's actually 100%
 * and don't show 0% unless it's actually 0%
 *
 * @param percentage - The calculated percentage value
 * @param balance - The actual balance (to check if it's exactly 0 or equals total)
 * @param total - The total balance
 * @returns Formatted percentage string (without % symbol)
 */
export const formatPercentage = (
  percentage: number,
  balance: bigint,
  total: bigint
): string => {
  // If balance is 0, show 0%
  if (balance === 0n) return '0';
  // If balance equals total, show 100%
  if (balance === total) return '100';
  // Otherwise, cap between <0.01% and >99.99%
  const rounded = Math.round(percentage);
  if (rounded >= 100) return '>99.99';
  if (rounded <= 0) return '<0.01';
  return rounded.toString();
};
