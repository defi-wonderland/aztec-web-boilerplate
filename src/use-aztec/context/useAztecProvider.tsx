import React, { type ReactNode, useEffect } from 'react';
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
 */
export const UseAztecProvider: React.FC<UseAztecProviderProps> = ({
  client,
  children,
}) => {
  useEffect(() => {
    setClient(client);
    return () => setClient(null);
  }, [client]);

  return (
    <UseAztecRuntimeContext.Provider value={client}>
      {children}
    </UseAztecRuntimeContext.Provider>
  );
};
