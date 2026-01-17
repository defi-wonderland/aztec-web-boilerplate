import type { ConnectorFactory } from '../aztec-wallet/connectors/registry';
import type { AztecNetwork } from '../config/networks/constants';

export interface NetworkPreset {
  aztecNetwork: AztecNetwork;
  nodeUrl: string;
}

export interface WalletKitConfig {
  connectors: ConnectorFactory[];
  networks: NetworkPreset[];
}
