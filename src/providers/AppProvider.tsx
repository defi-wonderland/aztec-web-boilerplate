import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { queryClient } from '../lib/queryClient';
import { wagmiConfig } from '../config/wagmi';
import { ErrorProvider } from './ErrorProvider';
import { UniversalWalletProvider } from './UniversalWalletProvider';
import { ThemeProvider } from './ThemeProvider';
import { ContractProviderWrapper } from './ContractProviderWrapper';
import { walletKitConfig } from '../config/walletKit';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ThemeProvider>
          <ErrorProvider>
            <UniversalWalletProvider config={walletKitConfig}>
              <ContractProviderWrapper>{children}</ContractProviderWrapper>
            </UniversalWalletProvider>
          </ErrorProvider>
        </ThemeProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};
