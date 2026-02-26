import React, { type ReactNode } from 'react';
import { useWalletExecutionClient } from '../integrations/use-aztec-wallet';
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
  const client = useWalletExecutionClient();

  return <UseAztecProvider client={client}>{children}</UseAztecProvider>;
};
