import { useContext } from 'react';
import { UniversalWalletContext } from '../../providers/UniversalWalletProvider';

/**
 * Hook to access the universal wallet context
 * Provides a unified interface for both embedded and Azguard wallets
 */
export const useUniversalWallet = () => {
  const context = useContext(UniversalWalletContext);
  
  if (context === undefined) {
    throw new Error('useUniversalWallet must be used within a UniversalWalletProvider');
  }
  
  return context;
};
