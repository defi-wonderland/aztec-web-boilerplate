import React, { type ReactNode } from 'react';
import { UseAztecContext } from './useAztecContext';
import type { UseAztecConfig } from '../config/types';

interface UseAztecProviderProps {
  config: UseAztecConfig;
  children: ReactNode;
}

/**
 * Provides the resolved UseAztecConfig to all descendant hooks.
 *
 * @example
 * ```tsx
 * const config = createUseAztecConfig({ connector, account, isConnected });
 * <UseAztecProvider config={config}>
 *   <App />
 * </UseAztecProvider>
 * ```
 */
export const UseAztecProvider: React.FC<UseAztecProviderProps> = ({
  config,
  children,
}) => {
  return (
    <UseAztecContext.Provider value={config}>
      {children}
    </UseAztecContext.Provider>
  );
};
