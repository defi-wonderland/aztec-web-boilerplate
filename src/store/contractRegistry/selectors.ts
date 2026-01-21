import { useContractRegistryStore } from './store';

export const useContractRegistryStatus = () =>
  useContractRegistryStore((state) => state.status);

export const useContractRegistryError = () =>
  useContractRegistryStore((state) => state.error);

export const useContractRegistryTimingInfo = () =>
  useContractRegistryStore((state) => state.timingInfo);
