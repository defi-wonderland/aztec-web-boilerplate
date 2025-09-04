import { useContext } from 'react';
import { EVMWalletContext } from '../../providers/AzGuardWalletProvider';

export const useEVMWallet = () => {
  const context = useContext(EVMWalletContext);
  if (context === undefined) {
    throw new Error('useEVMWallet must be used within an AzGuardWalletProvider');
  }
  return context;
};
