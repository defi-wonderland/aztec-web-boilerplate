import { useCallback } from 'react';
import { hasHexPrefix, truncate } from '@aztec/foundation/string';

export const useAddressUtils = () => {
  const truncateAddress = useCallback((address: string | undefined): string => {
    const formattedAddress = hasHexPrefix(address) ? address : `0x${address}`;
    return truncate(formattedAddress, 20);
  }, []);

  const formatAddress = useCallback((address: string | undefined): string => {
    if (!address) return '';
    return hasHexPrefix(address) ? address : `0x${address}`;
  }, []);

  return {
    truncateAddress,
    formatAddress,
  };
};