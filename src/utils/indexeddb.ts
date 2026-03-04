/**
 * IndexedDB Promise Utilities
 *
 * Helpers to wrap IndexedDB callback-based APIs in Promises
 * for cleaner async/await usage.
 */

/**
 * Valid fallback values for wrapIDBRequest (excludes { throw: string } pattern).
 */
type IDBFallbackValue = null | undefined;

/**
 * Wraps an IDBRequest in a Promise.
 *
 * @param request - The IDBRequest to wrap
 * @param onError - Error handling: `{ throw: 'message' }` to reject, or a fallback value to resolve
 *
 * @example
 * // Throws on error
 * await wrapIDBRequest(store.get(id), { throw: 'Failed to read' });
 *
 * // Returns null on error
 * await wrapIDBRequest(store.get(id), null);
 */
export function wrapIDBRequest<T>(
  request: IDBRequest<T>,
  onError: { throw: string }
): Promise<T>;
export function wrapIDBRequest<T, F extends IDBFallbackValue>(
  request: IDBRequest<T>,
  onError: F
): Promise<T | F>;
export function wrapIDBRequest<T, F extends IDBFallbackValue>(
  request: IDBRequest<T>,
  onError: F | { throw: string }
): Promise<T | F> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      const throwable =
        typeof onError === 'object' && onError !== null
          ? (onError as { throw?: string })
          : null;

      if (typeof throwable?.throw === 'string') {
        reject(new Error(throwable.throw));
      } else {
        resolve(onError as F);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Wraps an IDBTransaction completion in a Promise.
 *
 * @param transaction - The IDBTransaction to wrap
 * @param value - Value to return on success
 * @param fallback - Value to return on error (defaults to null)
 */
export function wrapIDBTransaction<T, F = null>(
  transaction: IDBTransaction,
  value: T,
  fallback: F = null as F
): Promise<T | F> {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => resolve(fallback);
  });
}

/**
 * Wraps an IDBOpenDBRequest in a Promise with upgrade handler support.
 *
 * @param request - The IDBOpenDBRequest to wrap
 * @param onUpgrade - Optional callback for database upgrades
 * @returns The database or null on error
 */
export function wrapIDBOpen(
  request: IDBOpenDBRequest,
  onUpgrade?: (db: IDBDatabase) => void
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (onUpgrade) {
      request.onupgradeneeded = () => onUpgrade(request.result);
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * Wraps deleteDatabase request. Resolves on success, error, or blocked.
 */
export function wrapIDBDelete(request: IDBOpenDBRequest): Promise<void> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/**
 * Requests persistent storage for IndexedDB data.
 * Prevents browser from evicting data under storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) return true;
  return navigator.storage.persist();
}
