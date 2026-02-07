import { useContractRegistryStore } from './store';

export const useContractRegistryStatus = () =>
  useContractRegistryStore((state) => state.status);
