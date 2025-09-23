import { useCallback } from 'react';
import { hasHexPrefix, truncate } from '@aztec/foundation/string';
import { AZTEC_TEST_CHAIN_ID } from '@aztec/ethereum';
import type { CaipAccount } from '../types/azguard';

export const useAddressUtils = () => {
  const truncateAddress = useCallback((address: string | undefined): string => {
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
    switch (chainId) {
      case '31337': return 'Sandbox';
      case AZTEC_TEST_CHAIN_ID.toString(): return 'Testnet';
      case '1337': return 'Devnet';
      default: return `Chain ${chainId}`;
    }
  }, []);

  return {
    truncateAddress,
    formatAddress,
    truncateCaipAddress,
    getCaipChainName,
  };
};