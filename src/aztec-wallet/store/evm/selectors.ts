import { useEVMStore } from './store';

/**
 * EVM address (convenience selector)
 */
export const useEVMAddress = () => useEVMStore((state) => state.address);

/**
 * EVM availability (convenience selector)
 */
export const useEVMAvailable = () => useEVMStore((state) => state.isAvailable);
