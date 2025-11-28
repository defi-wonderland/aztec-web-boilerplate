import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { ConfigProvider } from './ConfigProvider';
import { ErrorProvider } from './ErrorProvider';
import { AztecWalletProvider } from './AztecWalletProvider';
import { AzguardWalletProvider } from './AzguardWalletProvider';
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
            <AzguardWalletProvider>
              <AztecWalletProvider>
                <ContractProviderWrapper>
                  <UniversalWalletProvider>
                    {children}
                  </UniversalWalletProvider>
                </ContractProviderWrapper>
              </AztecWalletProvider>
            </AzguardWalletProvider>
          </ErrorProvider>
        </ConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
