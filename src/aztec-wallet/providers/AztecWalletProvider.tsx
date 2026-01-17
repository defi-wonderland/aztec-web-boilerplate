import React, { useMemo } from 'react';
import { AztecWalletModals } from '../components/AztecWalletModals';
import { createAztecWalletConfig } from '../config';
import { useEIP6963Discovery } from '../hooks/useEIP6963Discovery';
import { getEVMWalletService } from '../services/evm';
import { useWalletStore } from '../store/wallet';
import { AztecWalletContext } from './context';
import type { AztecWalletConfig } from '../types';

export interface AztecWalletProviderProps {
  /** AztecWallet configuration */
  config: AztecWalletConfig;
  /** Child components */
  children: React.ReactNode;
}

/**
 * AztecWallet Provider
 *
 * Lightweight provider that:
 * 1. Resolves the configuration with defaults
 * 2. Provides configuration context to components
 *
 * NOTE: This provider does NOT initialize connectors.
 * Connectors are initialized by UniversalWalletProvider.
 * This provider only provides the UI configuration for AztecWallet components.
 */
export const AztecWalletProvider: React.FC<AztecWalletProviderProps> = ({
  config: userConfig,
  children,
}) => {
  // Trigger EIP-6963 wallet discovery for EVM wallets
  // This populates the EVM store with discovered wallets
  const evmServiceAvailable = getEVMWalletService().isAvailable();
  useEIP6963Discovery(evmServiceAvailable);

  // Resolve config with defaults
  const resolvedConfig = useMemo(
    () => createAztecWalletConfig(userConfig),
    [userConfig]
  );

  // Check if connectors are already initialized (by UniversalWalletProvider)
  const connectors = useWalletStore((state) => state.connectors);
  const isInitialized = connectors.length > 0;

  // Context value
  const contextValue = useMemo(
    () => ({
      config: resolvedConfig,
      isInitialized,
    }),
    [resolvedConfig, isInitialized]
  );

  return (
    <AztecWalletContext.Provider value={contextValue}>
      {children}
      <AztecWalletModals />
    </AztecWalletContext.Provider>
  );
};
