import React, { type ReactNode, useMemo } from 'react';
import { setClient } from '../config/clientStore';
import { UseAztecRuntimeContext } from './useAztecRuntimeContext';
import type { AztecExecutionClient } from '../runtime/types';

interface UseAztecProviderProps {
  client: AztecExecutionClient | null;
  children: ReactNode;
}

/**
 * Provides the Aztec execution client to all descendant use-aztec hooks
 * and syncs it to the module-level store for action functions.
 *
 * The client is synced via useMemo (runs synchronously during render) to
 * avoid a null gap when the provider remounts or the client reference changes.
 */
export const UseAztecProvider: React.FC<UseAztecProviderProps> = ({
  client,
  children,
}) => {
  useMemo(() => setClient(client), [client]);

  return (
    <UseAztecRuntimeContext.Provider value={client}>
      {children}
    </UseAztecRuntimeContext.Provider>
  );
};
