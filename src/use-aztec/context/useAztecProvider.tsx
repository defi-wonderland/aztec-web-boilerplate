import React, { type ReactNode } from 'react';
import { UseAztecRuntimeContext } from './useAztecRuntimeContext';
import type { AztecExecutionClient } from '../runtime/types';

interface UseAztecProviderProps {
  client: AztecExecutionClient | null;
  children: ReactNode;
}

/**
 * Provides the Aztec execution client to all descendant use-aztec hooks.
 */
export const UseAztecProvider: React.FC<UseAztecProviderProps> = ({
  client,
  children,
}) => {
  return (
    <UseAztecRuntimeContext.Provider value={client}>
      {children}
    </UseAztecRuntimeContext.Provider>
  );
};
