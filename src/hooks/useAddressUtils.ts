import { useCallback } from 'react';
import { ADDRESS_TRUNCATE_START, ADDRESS_TRUNCATE_END } from '../config/bridgeConstants';

export const useAddressUtils = () => {
  const truncateAddress = useCallback((address: string | undefined): string => {
    if (!address) return 'No address set';
    
    const formattedAddress = address.startsWith('0x') ? address : `0x${address}`;
    
    if (formattedAddress.length <= 10) return formattedAddress;
    
    return `${formattedAddress.slice(0, ADDRESS_TRUNCATE_START)}...${formattedAddress.slice(-ADDRESS_TRUNCATE_END)}`;
  }, []);

  const formatAddress = useCallback((address: string | undefined): string => {
    if (!address) return '';
    return address.startsWith('0x') ? address : `0x${address}`;
  }, []);

  return {
    truncateAddress,
    formatAddress,
  };
};