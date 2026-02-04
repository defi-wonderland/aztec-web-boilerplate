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
