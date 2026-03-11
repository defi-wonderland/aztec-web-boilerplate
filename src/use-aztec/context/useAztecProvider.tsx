import React, { useMemo, type ReactNode } from 'react';
import { UseAztecRuntimeContext } from './useAztecRuntimeContext';
import type { AztecExecutionClient } from '../types/execution';

export interface UseAztecProviderProps {
  client: AztecExecutionClient | null;
  networkId?: string;
  children: ReactNode;
}

/**
 * Provides the Aztec execution client to all descendant use-aztec hooks.
 * Hooks and actions access the client via React context.
 */
export const UseAztecProvider: React.FC<UseAztecProviderProps> = ({
  client,
  networkId,
  children,
}) => {
  const value = useMemo(() => ({ client, networkId }), [client, networkId]);

  return (
    <UseAztecRuntimeContext.Provider value={value}>
      {children}
    </UseAztecRuntimeContext.Provider>
  );
};
