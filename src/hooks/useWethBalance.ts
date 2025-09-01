import { useState, useEffect } from 'react';
import { useAztecWallet } from './context/useAztecWallet';
import { BRIDGE_CONFIG } from '../config/networks/testnet';

export const useWethBalance = () => {
  const { connectedAccount: aztecWallet, tokenService } = useAztecWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!tokenService || !aztecWallet) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const ownerAddress = aztecWallet.getAddress().toString();
      
      // Fetch WETH private balance
      const privateBalance = await tokenService.getWethPrivateBalance(
        BRIDGE_CONFIG.aztecWETH, 
        ownerAddress
      );

      setBalance(privateBalance);
      
    } catch (err) {
      console.error('Failed to fetch WETH balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch WETH balance');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [aztecWallet, tokenService]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance
  };
};