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
