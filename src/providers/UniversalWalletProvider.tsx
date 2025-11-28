import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { useAztecWallet, useAzguardWallet } from '../hooks';
import { WalletType } from '../types/aztec';

interface UniversalWalletContextType {
  // Current active wallet
  activeWalletType: WalletType | null;
  activeAccount: AccountWithSecretKey | null;
  isConnected: boolean;
  
  // Wallet switching
  switchToEmbedded: () => Promise<void>;
  switchToAzguard: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Account information
  getAccountAddress: () => string | null;
  getWalletType: () => WalletType | null;
}

export const UniversalWalletContext = createContext<UniversalWalletContextType | undefined>(undefined);

interface UniversalWalletProviderProps {
  children: ReactNode;
}

export const UniversalWalletProvider: React.FC<UniversalWalletProviderProps> = ({ children }) => {
  const [activeWalletType, setActiveWalletType] = useState<WalletType | null>(null);
  const [activeAccount, setActiveAccount] = useState<AccountWithSecretKey | null>(null);
  
  const { connectedAccount: embeddedAccount, disconnectWallet: disconnectEmbedded } = useAztecWallet();
  const { 
    state: azguardState, 
    disconnect: disconnectAzguard, 
    getAccountWallet 
  } = useAzguardWallet();

  // Update active wallet based on connection states
  useEffect(() => {
    const updateActiveWallet = async () => {
      if (azguardState.isConnected && azguardState.selectedAccount) {
        try {
          const azguardAccountWallet = await getAccountWallet(azguardState.selectedAccount);
          setActiveWalletType(WalletType.AZGUARD);
          setActiveAccount(azguardAccountWallet);
        } catch (error) {
          console.error('Failed to get Azguard AccountWallet:', error);
          setActiveWalletType(null);
          setActiveAccount(null);
        }
      } else if (embeddedAccount) {
        setActiveWalletType(WalletType.EMBEDDED);
        setActiveAccount(embeddedAccount);
      } else {
        setActiveWalletType(null);
        setActiveAccount(null);
      }
    };

    updateActiveWallet();
  }, [embeddedAccount, azguardState.isConnected, azguardState.selectedAccount, getAccountWallet]);

  const switchToEmbedded = async () => {
    // Disconnect Azguard if connected
    if (azguardState.isConnected) {
      await disconnectAzguard();
    }
    // The embedded wallet connection should be handled by the user through the UI
  };

  const switchToAzguard = async () => {
    // Disconnect embedded wallet if connected
    if (embeddedAccount) {
      disconnectEmbedded();
    }
    // The Azguard wallet connection should be handled by the user through the UI
  };

  const disconnect = async () => {
    if (activeWalletType === WalletType.AZGUARD) {
      await disconnectAzguard();
    } else if (activeWalletType === WalletType.EMBEDDED) {
      disconnectEmbedded();
    }
  };

  const getAccountAddress = (): string | null => {
    if (!activeAccount) return null;
    return activeAccount.getAddress().toString();
  };

  const getWalletType = (): WalletType | null => {
    return activeWalletType;
  };

  const isConnected = activeAccount !== null;

  const contextValue: UniversalWalletContextType = {
    activeWalletType,
    activeAccount,
    isConnected,
    switchToEmbedded,
    switchToAzguard,
    disconnect,
    getAccountAddress,
    getWalletType,
  };

  return (
    <UniversalWalletContext.Provider value={contextValue}>
      {children}
    </UniversalWalletContext.Provider>
  );
};
