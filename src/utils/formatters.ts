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
  return value.toLocaleString();
};

/**
 * Compact number formatter with suffix (M, B, T, Q)
 * Only abbreviates numbers >= 1 million.
 * Uses bigint arithmetic to avoid precision loss for large values.
 */

const BIGINT_SUFFIXES = [
  {
    threshold: 1_000_000_000_000_000n,
    suffix: 'Q',
    divisor: 1_000_000_000_000_000n,
  },
  { threshold: 1_000_000_000_000n, suffix: 'T', divisor: 1_000_000_000_000n },
  { threshold: 1_000_000_000n, suffix: 'B', divisor: 1_000_000_000n },
  { threshold: 1_000_000n, suffix: 'M', divisor: 1_000_000n },
] as const;

const NUMBER_SUFFIXES = [
  { threshold: 1e15, suffix: 'Q', divisor: 1e15 },
  { threshold: 1e12, suffix: 'T', divisor: 1e12 },
  { threshold: 1e9, suffix: 'B', divisor: 1e9 },
  { threshold: 1e6, suffix: 'M', divisor: 1e6 },
] as const;

const formatCompactBigint = (value: bigint): CompactNumberResult => {
  for (const { threshold, suffix, divisor } of BIGINT_SUFFIXES) {
    if (value >= threshold) {
      const integer = value / divisor;
      const remainder = value % divisor;
      // Scale remainder to get 2 decimal digits
      const decimals = (remainder * 100n) / divisor;
      const intNum = Number(integer);
      const decNum = Number(decimals);

      let roundedDec = Math.round(decNum / 10);
      let finalInt = intNum;
      if (roundedDec === 10) {
        finalInt += 1;
        roundedDec = 0;
      }
      const formatted =
        intNum >= 100
          ? `${finalInt}.${String(roundedDec).padStart(1, '0')}`
          : `${intNum}.${String(decNum).padStart(2, '0')}`;
      return { value: `${formatted}${suffix}`, isCompact: true };
    }
  }

  // Below 1M — safe to convert since value < 1_000_000
  return { value: Number(value).toLocaleString(), isCompact: false };
};

const formatCompactNumber = (value: number): CompactNumberResult => {
  for (const { threshold, suffix, divisor } of NUMBER_SUFFIXES) {
    if (value >= threshold) {
      const divided = value / divisor;
      const formatted =
        divided >= 100 ? divided.toFixed(1) : divided.toFixed(2);
      return { value: `${formatted}${suffix}`, isCompact: true };
    }
  }

  return { value: value.toLocaleString(), isCompact: false };
};

export const formatNumberCompact = (
  value: bigint | number
): CompactNumberResult => {
  return typeof value === 'bigint'
    ? formatCompactBigint(value)
    : formatCompactNumber(value);
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
  // Cap between <0.01% and >99.99% using raw value before rounding
  if (percentage >= 99.99) return '>99.99';
  if (percentage <= 0.01) return '<0.01';
  return Math.round(percentage).toString();
};
