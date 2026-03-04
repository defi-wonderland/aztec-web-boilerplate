// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Convert snake_case or camelCase to Title Case.
 * @param str - The string to convert
 * @returns The string in Title Case format
 * @example
 * toTitleCase('hello_world') // 'Hello World'
 * toTitleCase('helloWorld') // 'Hello World'
 * toTitleCase('constructor_with_minter') // 'Constructor With Minter'
 */
export const toTitleCase = (str: string): string => {
  return str
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Safely stringify a value, converting BigInt to string.
 * @param value - The value to stringify
 * @returns JSON string with BigInt values converted to strings
 */
export const safeStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );

// ============================================================================
// BALANCE & DATE FORMATTING
// ============================================================================

/**
 * Formats a bigint balance with decimals for display.
 *
 * @param balance - The raw balance as bigint
 * @param decimals - Number of decimals (default: 18)
 * @param maxFractionalDigits - Max fractional digits to show (default: 4)
 * @returns Formatted balance string
 *
 * @example
 * ```ts
 * formatBalance(1000000000000000000n) // "1"
 * formatBalance(1234500000000000000n) // "1.2345"
 * formatBalance(1000000n, 6) // "1"
 * ```
 */
export const formatBalance = (
  balance: bigint,
  decimals = 18,
  maxFractionalDigits = 4
): string => {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const fractional = balance % divisor;

  if (fractional === 0n) {
    return whole.toLocaleString();
  }

  const fractionalStr = fractional.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr
    .slice(0, maxFractionalDigits)
    .replace(/0+$/, '');

  if (trimmedFractional === '') {
    return whole.toLocaleString();
  }

  return `${whole.toLocaleString()}.${trimmedFractional}`;
};

/**
 * Formats Fee Juice balance for display.
 * Fee Juice uses 18 decimals.
 *
 * @param balance - The raw Fee Juice balance as bigint
 * @returns Formatted balance string
 */
export const formatFeeJuiceBalance = (balance: bigint): string => {
  return formatBalance(balance, 18, 4);
};

/**
 * Format a relative time string (e.g., "2s ago", "1m ago")
 */
export const formatRelativeTime = (date: Date | number | null): string => {
  if (date == null) return 'N/A';

  const ms = typeof date === 'number' ? date : date.getTime();
  const seconds = Math.floor((Date.now() - ms) / 1000);

  if (seconds < 5) return 'Now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

/** Format a Date to HH:MM:SS (24-hour). */
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/** Format a Date as a short relative date label. */
export const formatDate = (date: Date): string => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============================================================================
// NUMBER FORMATTING
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

      let formatted: string;
      if (intNum >= 100) {
        const roundedDec = Math.round(decNum / 10);
        formatted =
          roundedDec >= 10 ? `${intNum + 1}.0` : `${intNum}.${roundedDec}`;
      } else {
        formatted = `${intNum}.${String(decNum).padStart(2, '0')}`;
      }
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

  // Post-rounding guards: prevent Math.round from producing 0 or 100
  // when the exact-match branches above already ruled those out
  const rounded = Math.round(percentage);
  if (rounded >= 100) return '99.99';
  if (rounded <= 0) return '0.01';
  return rounded.toString();
};
