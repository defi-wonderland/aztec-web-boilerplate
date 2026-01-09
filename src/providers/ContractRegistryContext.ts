import { createContext, useContext } from 'react';
import type {
  ContractConfigMap,
  IContractRegistry,
} from '../contract-registry';

export type ContractContextValue<
  T extends ContractConfigMap = ContractConfigMap,
> = {
  registry: IContractRegistry<T> | null;
};

export const ContractRegistryContext =
  createContext<ContractContextValue | null>(null);

export function useContractRegistryContext<
  T extends ContractConfigMap = ContractConfigMap,
>(): ContractContextValue<T> {
  const context = useContext(ContractRegistryContext);

  if (context === null) {
    return { registry: null } as ContractContextValue<T>;
  }

  return context as ContractContextValue<T>;
}
