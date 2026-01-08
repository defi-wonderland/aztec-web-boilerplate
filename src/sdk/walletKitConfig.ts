import type { AztecNetwork } from '../config/networks/constants';
import type { ConnectorFactory } from '../connectors/registry';

export interface NetworkPreset {
  aztecNetwork: AztecNetwork;
  nodeUrl: string;
}

export interface WalletKitConfig {
  connectors: ConnectorFactory[];
  networks: NetworkPreset[];
}
