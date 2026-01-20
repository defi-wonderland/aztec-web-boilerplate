import type {
  WalletConnector,
  WalletConnectorId,
} from '../../types/walletConnector';

export type ConnectorFactory = () => WalletConnector;

export interface ConnectorRegistryOptions {
  /**
   * Optional priority list to override default connector order.
   * Connectors not listed here maintain their factory order after the prioritized entries.
   */
  priority?: WalletConnectorId[];
}

export class ConnectorRegistry {
  private readonly connectors: WalletConnector[];

  constructor(
    factories: ConnectorFactory[],
    options: ConnectorRegistryOptions = {}
  ) {
    const instantiated = factories.map((factory) => factory());

    if (options.priority && options.priority.length > 0) {
      const prioritySet = new Set(options.priority);
      const prioritized: WalletConnector[] = [];

      options.priority.forEach((id) => {
        const connector = instantiated.find((c) => c.id === id);
        if (connector) {
          prioritized.push(connector);
        }
      });

      const remaining = instantiated.filter((c) => !prioritySet.has(c.id));
      this.connectors = [...prioritized, ...remaining];
    } else {
      this.connectors = instantiated;
    }
  }

  /**
   * Get all instantiated connectors in priority order.
   */
  getConnectors(): WalletConnector[] {
    return this.connectors;
  }

  /**
   * Find connector by ID.
   */
  getConnector(id: WalletConnectorId): WalletConnector | undefined {
    return this.connectors.find((connector) => connector.id === id);
  }

  /**
   * Resolve the first connector that currently has an active account.
   */
  getActiveConnector(): WalletConnector | null {
    for (const connector of this.connectors) {
      if (connector.getAccount()) {
        return connector;
      }
    }
    return null;
  }
}

export const createConnectorRegistry = (
  factories: ConnectorFactory[],
  options?: ConnectorRegistryOptions
): ConnectorRegistry => new ConnectorRegistry(factories, options);
