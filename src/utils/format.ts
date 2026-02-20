/**
 * Formatting utility functions for displaying values.
 */

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
