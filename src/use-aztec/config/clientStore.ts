import { AztecClientNotReadyError } from '../runtime/errors';
import type { AztecExecutionClient } from '../runtime/types';

let _client: AztecExecutionClient | null = null;

/** Called by UseAztecProvider to set/clear the module-level client. */
export const setClient = (client: AztecExecutionClient | null): void => {
  _client = client;
};

/**
 * Returns the current execution client.
 * Throws `AztecClientNotReadyError` if the provider hasn't initialized yet.
 *
 * @internal Used by action functions — consumers should never call this directly.
 */
export const getClient = (): AztecExecutionClient => {
  if (!_client) {
    throw new AztecClientNotReadyError();
  }
  return _client;
};

/** Returns the current client or null (no throw). */
export const getClientOrNull = (): AztecExecutionClient | null => {
  return _client;
};
