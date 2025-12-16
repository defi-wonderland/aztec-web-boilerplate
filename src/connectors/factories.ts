import { EmbeddedConnector } from './EmbeddedConnector';
import { AzguardConnector } from './AzguardConnector';
import type { ConnectorFactory } from './registry';

/**
 * Embedded wallet connector preset.
 * Usage: connectors: [embedded()]
 */
export const embedded = (): ConnectorFactory => () => new EmbeddedConnector();

/**
 * Azguard wallet connector preset.
 * Usage: connectors: [azguard()]
 */
export const azguard = (): ConnectorFactory => () => new AzguardConnector();

