import { useContext } from 'react';
import { AzguardWalletContext } from '../../providers/AzguardWalletProvider';
import type { AzguardWalletContextType } from '../../types/azguard';

/**
 * Hook to access Azguard wallet context
 * @returns AzguardWalletContextType
 * @throws Error if used outside of AzguardWalletProvider
 */
export const useAzguardWallet = (): AzguardWalletContextType => {
  const context = useContext(AzguardWalletContext);
  
  if (context === undefined) {
    throw new Error('useAzguardWallet must be used within an AzguardWalletProvider');
  }
  
  return context;
};
