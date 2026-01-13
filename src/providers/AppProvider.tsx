import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { walletKitConfig } from '../config/walletKit';
import { queryClient } from '../lib/queryClient';
import { ModalProvider, ToastProvider } from '../hooks';
import { Toaster, TooltipProvider } from '../components/ui';
import { EmbeddedContractProvider } from './EmbeddedContractProvider';
import { ThemeProvider } from './ThemeProvider';
import { UniversalWalletProvider } from './UniversalWalletProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <ToastProvider>
            <ModalProvider>
              <UniversalWalletProvider config={walletKitConfig}>
                <EmbeddedContractProvider>{children}</EmbeddedContractProvider>
              </UniversalWalletProvider>
            </ModalProvider>
            <Toaster />
          </ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
