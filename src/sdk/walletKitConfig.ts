import type { ConnectorFactory } from '../connectors/registry';

export type AztecNetworkId = 'sandbox' | 'devnet';

export interface WalletKitNetworkPreset {
  /**
   * Concrete Aztec network identifier (sandbox/devnet).
   */
  aztecNetwork: AztecNetworkId;
  /**
   * RPC endpoint for the Aztec node backing that network.
   */
  nodeUrl: string;
}

export interface WalletKitPreset {
  connectors: ConnectorFactory[];
  networks: WalletKitNetworkPreset[];
}

export const resolveWalletKitNode = (
  networks: WalletKitNetworkPreset[],
  aztecNetwork: AztecNetworkId,
  fallbackNode: string
): string => {
  return (
    networks.find((entry) => entry.aztecNetwork === aztecNetwork)?.nodeUrl ??
    fallbackNode
  );
};

