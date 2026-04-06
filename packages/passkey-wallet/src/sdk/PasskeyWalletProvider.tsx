import { createContext, useRef, type ReactNode } from 'react';
import { type PasskeyWallet, createPasskeyWallet } from './createPasskeyWallet';
import type { PasskeyWalletConfig } from '../shared/types';

export const PasskeyWalletContext = createContext<PasskeyWallet | null>(null);

interface PasskeyWalletProviderProps {
  config: PasskeyWalletConfig;
  children: ReactNode;
}

export function PasskeyWalletProvider({ config, children }: PasskeyWalletProviderProps) {
  const walletRef = useRef<PasskeyWallet | null>(null);
  if (!walletRef.current) walletRef.current = createPasskeyWallet(config);
  return (
    <PasskeyWalletContext.Provider value={walletRef.current}>
      {children}
    </PasskeyWalletContext.Provider>
  );
}
