import { createContext, useContext } from 'react';
import type { ResolvedAztecWalletConfig } from '../types';

export interface AztecWalletContextValue {
  /** Resolved configuration */
  config: ResolvedAztecWalletConfig;
  /** Whether the wallet is initialized */
  isInitialized: boolean;
}

export const AztecWalletContext = createContext<AztecWalletContextValue | null>(
  null
);

export const useAztecWalletContext = (): AztecWalletContextValue => {
  const context = useContext(AztecWalletContext);
  if (!context) {
    throw new Error(
      'useAztecWalletContext must be used within AztecWalletProvider'
    );
  }
  return context;
};
