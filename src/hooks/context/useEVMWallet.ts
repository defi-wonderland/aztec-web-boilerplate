import { useCallback, useState } from 'react';
import type { Hex } from 'viem';
import { useUniversalWallet } from './useUniversalWallet';

export const useEVMWallet = () => {
  const { signer, needsSigner } = useUniversalWallet();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(() => {
    signer.connect().catch((err) => {
      console.error('Failed to connect wallet:', err);
    });
  }, [signer]);

  const connectWalletAsync = useCallback(async (): Promise<Hex | undefined> => {
    setIsConnecting(true);
    try {
      return await signer.connect();
    } finally {
      setIsConnecting(false);
    }
  }, [signer]);

  const disconnect = useCallback(() => {
    setIsDisconnecting(true);
    try {
      signer.disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  }, [signer]);

  return {
    address: signer.address,
    isConnected: signer.address !== null,
    isConnecting,
    isDisconnecting,
    isAvailable: signer.isAvailable,
    needsSigner,
    connectWallet,
    connectWalletAsync,
    disconnect,
    getService: signer.getService,
  };
};
