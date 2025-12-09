import { useCallback } from 'react';
import { hasHexPrefix } from '@aztec/foundation/string';
import type { CaipAccount } from '../types/azguard';
import { CHAIN_ID_TO_NETWORK, NETWORK_NAMES } from '../config/networks/constants';

const TRUNCATE_START = 6;
const TRUNCATE_END = 4;

export const useAddressUtils = () => {
  const truncateAddress = useCallback((address: string | undefined): string => {
    if (!address) return '';
    const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
    if (formattedAddress.length <= TRUNCATE_START + TRUNCATE_END) return formattedAddress;
    return `${formattedAddress.slice(0, TRUNCATE_START)}...${formattedAddress.slice(-TRUNCATE_END)}`;
  }, []);

  const formatAddress = useCallback((address: string | undefined): string => {
    if (!address) return '';
    return hasHexPrefix(address) ? address : `0x${address}`;
  }, []);

  // CAIP utilities using Aztec foundation
  const truncateCaipAddress = useCallback((caipAccount: CaipAccount | undefined): string => {
    if (!caipAccount) return '';
    const address = caipAccount.split(':')[2];
    const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
    if (formattedAddress.length <= TRUNCATE_START + TRUNCATE_END) return formattedAddress;
    return `${formattedAddress.slice(0, TRUNCATE_START)}...${formattedAddress.slice(-TRUNCATE_END)}`;
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