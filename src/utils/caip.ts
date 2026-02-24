import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { CaipAccount } from '@azguardwallet/types';

/**
 * Extracts the chain identifier from a CAIP account string.
 * CAIP format: namespace:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * @param caipAccount - The full CAIP account string
 * @returns The chain identifier (e.g., "aztec:testnet")
 */
export const getChainFromCaipAccount = (
  caipAccount: CaipAccount | string
): string => {
  const [namespace, chainId] = caipAccount.split(':');
  return `${namespace}:${chainId}`;
};

/**
 * Parses an AztecAddress from a CAIP account string.
 * CAIP format: aztec:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * Handles both:
 * - Full CAIP format: "aztec:chainId:0x..."
 * - Plain address: "0x..."
 * - Aztec addresses (66 chars) and Ethereum addresses (42 chars, padded)
 *
 * @param caipAccount - The CAIP account string or plain address
 * @returns The parsed AztecAddress
 */
export const parseAddressFromCaip = (caipAccount: string): AztecAddress => {
  const parts = caipAccount.split(':');
  const hasPrefix = parts.length === 3 && parts[0] === 'aztec';
  const addressStr = hasPrefix ? parts[2] : caipAccount;

  // Handle Aztec address format (66 chars: 0x + 64 hex)
  if (addressStr.length === 66) {
    return AztecAddress.fromString(addressStr);
  }

  // Handle Ethereum address format (42 chars: 0x + 40 hex) - pad to Aztec format
  if (addressStr.length === 42) {
    const paddedAddress = '0x' + addressStr.slice(2).padStart(64, '0');
    return AztecAddress.fromString(paddedAddress);
  }

  throw new Error(`Unsupported account format: ${caipAccount}`);
};
