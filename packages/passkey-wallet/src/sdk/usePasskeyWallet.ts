import { useContext, useState, useCallback } from 'react';
import { PasskeyWalletContext } from './PasskeyWalletProvider';
import type { Wallet } from '@aztec/aztec.js';

export function usePasskeyWallet() {
  const passkeyWallet = useContext(PasskeyWalletContext);
  if (!passkeyWallet) throw new Error('usePasskeyWallet must be used within a PasskeyWalletProvider');

  const [wallet, setWallet] = useState<Wallet | null>(passkeyWallet.getWallet());
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(passkeyWallet.getAddress());

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const w = await passkeyWallet.connect();
      setWallet(w);
      setAddress(passkeyWallet.getAddress());
    } finally {
      setIsConnecting(false);
    }
  }, [passkeyWallet]);

  const disconnect = useCallback(async () => {
    await passkeyWallet.disconnect();
    setWallet(null);
    setAddress(null);
  }, [passkeyWallet]);

  return { wallet, isConnected: wallet !== null, isConnecting, address, connect, disconnect };
}
