import { createContext, useContext } from 'react';
import type {
  ContractConfigMap,
  IContractRegistry,
} from '../contract-registry';

type ContractContextValue<T extends ContractConfigMap = ContractConfigMap> = {
  registry: IContractRegistry<T> | null;
};

export const ContractRegistryContext =
  createContext<ContractContextValue | null>(null);

/**
 * Hook to access the contract registry instance from context.
 * Returns the registry directly (or null if not available).
 */
export function useContractRegistryContext<
  T extends ContractConfigMap = ContractConfigMap,
>(): IContractRegistry<T> | null {
  const context = useContext(ContractRegistryContext);

  if (context === null) {
    return null;
  }

  return context.registry as IContractRegistry<T> | null;
}
