import { useInternalAztecClient } from '../context/useInternalAztecClient';
import type { AztecExecutionClient } from '../types/execution';

/**
 * Public hook to access the Aztec execution client.
 *
 * Returns `null` when the client is not yet initialized.
 * For most use cases, prefer the action functions (`writeContract`, `readContract`)
 * which resolve the client internally.
 *
 * @example
 * ```tsx
 * const client = useAztecClient();
 *
 * if (client) {
 *   // Low-level client access for advanced use cases
 * }
 * ```
 */
export const useAztecClient = (): AztecExecutionClient | null => {
  return useInternalAztecClient();
};
