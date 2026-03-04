import { createContext, useContext } from 'react';
import type { ContractRegistryWalletAdapter } from './adapter';
import type { ContractConfigMap } from './core/types';

export interface ContractRegistryContextValue {
  wallet: ContractRegistryWalletAdapter;
  contracts: ContractConfigMap;
}

export const ContractRegistryContext =
  createContext<ContractRegistryContextValue | null>(null);

/**
 * Internal hook to access the contract registry context.
 * Throws if used outside a ContractRegistryProvider.
 */
export function useRegistryContext(): ContractRegistryContextValue {
  const ctx = useContext(ContractRegistryContext);
  if (!ctx) {
    throw new Error(
      'useRegistryContext must be used within a <ContractRegistryProvider>'
    );
  }
  return ctx;
}
