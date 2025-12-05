import type { ConnectorFactory } from '../connectors/registry';
import type { AztecNetwork } from '../config/networks/constants';

export interface WalletKitNetworkPreset {
  /**
   * Concrete Aztec network identifier (sandbox/devnet).
   */
  aztecNetwork: AztecNetwork;
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
  aztecNetwork: AztecNetwork,
  fallbackNode: string
): string => {
  return (
    networks.find((entry) => entry.aztecNetwork === aztecNetwork)?.nodeUrl ??
    fallbackNode
  );
};

