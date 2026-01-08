import {
  createConnectorRegistry,
  ConnectorRegistry,
} from '../connectors/registry';
import type {
  ConnectorFactory,
  ConnectorRegistryOptions,
} from '../connectors/registry';
import type {
  WalletConnector,
  WalletConnectorId,
} from '../types/walletConnector';

export interface WalletKitConfig extends ConnectorRegistryOptions {
  aztecNode: string;
  connectors: ConnectorFactory[];
}

export class AztecWalletKit {
  private readonly registry: ConnectorRegistry;
  readonly aztecNode: string;

  constructor(config: WalletKitConfig) {
    this.registry = createConnectorRegistry(config.connectors, {
      priority: config.priority,
    });
    this.aztecNode = config.aztecNode;
  }

  getConnectors(): WalletConnector[] {
    return this.registry.getConnectors();
  }

  getConnector(id: WalletConnectorId): WalletConnector | undefined {
    return this.registry.getConnector(id);
  }

  getActiveConnector(): WalletConnector | null {
    return this.registry.getActiveConnector();
  }

  async connect(id: WalletConnectorId): Promise<WalletConnector> {
    const connector = this.registry.getConnector(id);
    if (!connector) {
      throw new Error(`Connector "${id}" not found`);
    }
    await connector.connect();
    return connector;
  }

  async disconnect(id: WalletConnectorId): Promise<void> {
    const connector = this.registry.getConnector(id);
    if (!connector) {
      throw new Error(`Connector "${id}" not found`);
    }
    await connector.disconnect();
  }
}

export const createAztecWalletKit = (config: WalletKitConfig): AztecWalletKit =>
  new AztecWalletKit(config);
