import React, { type ReactNode } from 'react';
import { useAztecExecutionClient } from '../aztec-wallet';
import { UseAztecProvider } from '../use-aztec';

interface UseAztecClientProviderProps {
  children: ReactNode;
}

/**
 * Bridges aztec-wallet state to an execution-only use-aztec client.
 */
export const UseAztecClientProvider: React.FC<UseAztecClientProviderProps> = ({
  children,
}) => {
  const client = useAztecExecutionClient();

  return <UseAztecProvider client={client}>{children}</UseAztecProvider>;
};
