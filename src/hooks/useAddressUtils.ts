import { useCallback } from 'react';
import { hasHexPrefix, truncate } from '@aztec/foundation/string';
import type { CaipAccount } from '../types/azguard';
import { CHAIN_ID_TO_NETWORK, NETWORK_NAMES } from '../config/networks/constants';

export const useAddressUtils = () => {
  const truncateAddress = useCallback((address: string | undefined): string => {
    if (!address) return '';
    const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
    return truncate(formattedAddress, 10);
  }, []);

  const formatAddress = useCallback((address: string | undefined): string => {
    if (!address) return '';
    return hasHexPrefix(address) ? address : `0x${address}`;
  }, []);

  // CAIP utilities using Aztec foundation
  const truncateCaipAddress = useCallback((caipAccount: CaipAccount | undefined): string => {
    if (!caipAccount) return '';
    const address = caipAccount.split(':')[2];
    return truncate(hasHexPrefix(address) ? address : `0x${address}`, 10);
  }, []);

  const getCaipChainName = useCallback((caipAccount: CaipAccount): string => {
    const chainId = caipAccount.split(':')[1];
    const network = CHAIN_ID_TO_NETWORK[chainId];
    return network ? NETWORK_NAMES[network] : `Chain ${chainId}`;
  }, []);

  return {
    truncateAddress,
    formatAddress,
    truncateCaipAddress,
    getCaipChainName,
  };
};