/**
 * Extracts the chain identifier from a CAIP account string.
 * CAIP format: namespace:chainId:address (e.g., "aztec:testnet:0x1234...")
 *
 * @param caipAccount - The full CAIP account string
 * @returns The chain identifier (e.g., "aztec:testnet")
 */
export const getChainFromCaipAccount = (caipAccount: string): string => {
  const parts = caipAccount.split(':');
  const [namespace, chainId, address] = parts;
  if (parts.length < 3 || !namespace || !chainId || !address) {
    throw new Error(
      `Invalid CAIP account: expected namespace:chainId:address, got "${caipAccount}"`
    );
  }
  return `${namespace}:${chainId}`;
};
