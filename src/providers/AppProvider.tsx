import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { ErrorProvider } from './ErrorProvider';
import { UniversalWalletProvider } from './UniversalWalletProvider';
import { ThemeProvider } from './ThemeProvider';
import { EmbeddedContractProvider } from './EmbeddedContractProvider';
import { walletKitConfig } from '../config/walletKit';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorProvider>
          <UniversalWalletProvider config={walletKitConfig}>
            <EmbeddedContractProvider>
              {children}
            </EmbeddedContractProvider>
          </UniversalWalletProvider>
        </ErrorProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
