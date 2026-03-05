/**
 * Extracts the chain identifier from a CAIP account string.
 * CAIP format: namespace:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * @param caipAccount - The full CAIP account string
 * @returns The chain identifier (e.g., "aztec:testnet")
 */
export const getChainFromCaipAccount = (caipAccount: string): string => {
  const [namespace, chainId] = caipAccount.split(':');
  return `${namespace}:${chainId}`;
};
