/**
 * Contract list manipulation utilities.
 */

import type { CachedContract } from './types';

// =============================================================================
// Constants
// =============================================================================

export const MAX_SAVED_CONTRACTS = 10;

// =============================================================================
// List Operations
// =============================================================================

/**
 * Adds or updates a contract in the list.
 * Newer entries are placed at the front, duplicates are removed.
 */
export const upsertContract = (
  current: CachedContract[],
  next: CachedContract
): CachedContract[] => {
  const normalizedAddress = next.address.toLowerCase();
  const filtered = current.filter(
    (item) => item.address.toLowerCase() !== normalizedAddress
  );
  return [next, ...filtered].slice(0, MAX_SAVED_CONTRACTS);
};

/**
 * Removes a contract from the list by address.
 */
export const removeContract = (
  current: CachedContract[],
  address: string
): CachedContract[] => {
  const normalized = address.toLowerCase();
  return current.filter((item) => item.address.toLowerCase() !== normalized);
};
