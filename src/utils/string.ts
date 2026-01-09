/**
 * String utility functions for text transformations.
 */

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
