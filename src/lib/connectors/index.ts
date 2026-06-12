// Connector registry: both paths produce the same wallet-agnostic `Wallet`.
import { EmbeddedConnector } from './embedded';
import { ExternalConnector } from './external';
import type { ConnectorKind, WalletConnector } from './types';

export type {
  ConnectorKind,
  WalletConnector,
  ConnectOptions,
  ConnectResult,
  OnEmojiGrid,
} from './types';
export { EmbeddedConnector } from './embedded';
export { ExternalConnector } from './external';

/** Singleton instances of each available connector. */
export const connectors: WalletConnector[] = [
  new EmbeddedConnector(),
  new ExternalConnector(),
];

/** Return the connector for the given `kind`, or `undefined` if none exists. */
export function getConnector(kind: ConnectorKind): WalletConnector | undefined {
  return connectors.find((c) => c.kind === kind);
}
