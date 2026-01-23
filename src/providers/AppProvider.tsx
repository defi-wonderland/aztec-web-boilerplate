import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider, Toaster } from '../components/ui';
import { walletKitConfig } from '../config/walletKit';
import { ModalProvider, ToastProvider } from '../hooks';
import { queryClient } from '../lib/queryClient';
import { ArtifactInitializer } from './ArtifactInitializer';
import { UniversalWalletProvider } from './UniversalWalletProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <ModalProvider>
            <UniversalWalletProvider config={walletKitConfig}>
              <ArtifactInitializer>{children}</ArtifactInitializer>
            </UniversalWalletProvider>
          </ModalProvider>
          <Toaster />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};
