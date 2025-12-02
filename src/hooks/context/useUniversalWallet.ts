import { useContext } from 'react';
import { UniversalWalletContext } from '../../providers/UniversalWalletProvider';

export const useUniversalWallet = () => {
  const context = useContext(UniversalWalletContext);
  
  if (context === undefined) {
    throw new Error('useUniversalWallet must be used within a UniversalWalletProvider');
  }
  
  return context;
};

