import { useContext } from 'react';
import {
  WalletContext,
  type WalletContextType,
} from '../../providers/UniversalWalletProvider';

export const useWalletContext = (): WalletContextType => {
  const context = useContext(WalletContext);

  if (context === undefined) {
    throw new Error(
      'useWalletContext must be used within a UniversalWalletProvider'
    );
  }

  return context;
};
