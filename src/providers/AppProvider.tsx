import React, { ReactNode } from 'react';
import { ConfigProvider } from './ConfigProvider';
import { ErrorProvider } from './ErrorProvider';
import { AztecWalletProvider } from './AztecWalletProvider';
import { TokenProvider } from './TokenProvider';
import { AzguardWalletProvider } from './AzguardWalletProvider';
import { UniversalWalletProvider } from './UniversalWalletProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ConfigProvider>
      <ErrorProvider>
        <AzguardWalletProvider>
          <AztecWalletProvider>
            <UniversalWalletProvider>
              <TokenProvider>
                {children}
              </TokenProvider>
            </UniversalWalletProvider>
          </AztecWalletProvider>
        </AzguardWalletProvider>
      </ErrorProvider>
    </ConfigProvider>
  );
};
