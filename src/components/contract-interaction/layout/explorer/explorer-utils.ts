/**
 * Shared utilities for the ContractExplorerPanel and its sub-components.
 */

/** Threshold (characters) for showing expand toggle on log details. */
export const DETAIL_TRUNCATE_THRESHOLD = 120;

/**
 * Attempt to prettify a JSON string with indentation.
 * Returns the original string if parsing fails.
 */
export const prettifyJson = (str: string): string => {
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
};

/**
 * Format a simulation result value for display.
 * Parses JSON and returns the actual value without extra quotes for primitives.
 */
export const formatDisplayValue = (value: string): string => {
  try {
    const parsed = JSON.parse(value);
    // For primitives (string, number, boolean), return the value directly
    if (
      typeof parsed === 'string' ||
      typeof parsed === 'number' ||
      typeof parsed === 'boolean'
    ) {
      return String(parsed);
    }
    // For objects/arrays, return pretty-printed JSON
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
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

/** Format a Date as a human-friendly relative string. */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  return 'Today';
};
