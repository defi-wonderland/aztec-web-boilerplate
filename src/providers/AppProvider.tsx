import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { ConfigProvider } from './ConfigProvider';
import { ErrorProvider } from './ErrorProvider';
import { UniversalWalletProvider } from './UniversalWalletProvider';
import { ThemeProvider } from './ThemeProvider';
import { ContractProviderWrapper } from './ContractProviderWrapper';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfigProvider>
          <ErrorProvider>
            <UniversalWalletProvider>
              <ContractProviderWrapper>
                {children}
              </ContractProviderWrapper>
            </UniversalWalletProvider>
          </ErrorProvider>
        </ConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
