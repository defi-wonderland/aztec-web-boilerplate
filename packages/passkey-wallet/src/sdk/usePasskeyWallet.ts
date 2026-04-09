import { useContext, useState, useCallback } from 'react';
import { PasskeyWalletContext } from './PasskeyWalletProvider';
import type { Wallet } from '@aztec/aztec.js';

export function usePasskeyWallet() {
  const passkeyWallet = useContext(PasskeyWalletContext);
  if (!passkeyWallet) throw new Error('usePasskeyWallet must be used within a PasskeyWalletProvider');

  const [wallet, setWallet] = useState<Wallet | null>(passkeyWallet.getWallet());
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(passkeyWallet.getAddress());
  const [capabilities, setCapabilities] = useState<unknown>(null);

  const connect = useCallback(async (manifest?: unknown) => {
    setIsConnecting(true);
    try {
      const result = await passkeyWallet.connect(manifest);
      setWallet(result.wallet);
      setCapabilities(result.capabilities);
      setAddress(passkeyWallet.getAddress());
      return result;
    } finally {
      setIsConnecting(false);
    }
  }, [passkeyWallet]);

  const disconnect = useCallback(async () => {
    await passkeyWallet.disconnect();
    setWallet(null);
    setAddress(null);
  }, [passkeyWallet]);

  return { wallet, isConnected: wallet !== null, isConnecting, address, capabilities, connect, disconnect };
}
