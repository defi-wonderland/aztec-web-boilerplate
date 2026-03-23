/**
 * PXE Operation Queue
 *
 * Serializes PXE operations to prevent concurrent execution warnings.
 * The Aztec PXE doesn't support concurrent operations - it queues them
 * internally but produces warnings. This utility prevents those warnings
 * by ensuring only one operation runs at a time.
 *
 * ## When to use `queuePxeCall`
 *
 * ✅ USE for operations that can run concurrently during initialization:
 *   - Contract instantiation (`.at()` calls)
 *   - Auto-running queries on component mount (balance fetches)
 *   - Any PXE call triggered by React hooks mounting simultaneously
 *
 * ❌ SKIP for user-triggered actions that are naturally sequential:
 *   - Button click handlers (drip, transfer, etc.)
 *   - Manual refetch after user action
 *   - Operations already awaited in sequence
 *
 * User actions don't need queuing because users naturally wait for one
 * action to complete before triggering another. The queue is primarily
 * for React's concurrent mounting where multiple hooks initialize at once.
 */

let pxeOperationQueue: Promise<void> = Promise.resolve();

/**
 * Queue a PXE operation for serialized execution.
 * Operations are executed one at a time in the order they were queued.
 *
 * @param operation - Async function that performs PXE operations
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * // Queued: runs after any pending PXE operations complete
 * const balance = await queuePxeCall(() =>
 *   token.methods.balance_of_private(address).simulate()
 * );
 * ```
 */
export const queuePxeCall = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  const previousOperation = pxeOperationQueue;
  let resolve: () => void;
  pxeOperationQueue = new Promise((r) => {
    resolve = r;
  });

  try {
    await previousOperation;
    return await operation();
  } finally {
    resolve!();
  }
};
