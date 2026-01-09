import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { walletKitConfig } from '../config/walletKit';
import { queryClient } from '../lib/queryClient';
import { EmbeddedContractProvider } from './EmbeddedContractProvider';
import { ErrorProvider } from './ErrorProvider';
import { UniversalWalletProvider } from './UniversalWalletProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorProvider>
        <UniversalWalletProvider config={walletKitConfig}>
          <EmbeddedContractProvider>{children}</EmbeddedContractProvider>
        </UniversalWalletProvider>
      </ErrorProvider>
    </QueryClientProvider>
  );
};
