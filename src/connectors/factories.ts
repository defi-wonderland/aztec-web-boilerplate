import { createEmbeddedConnector } from './EmbeddedConnector';
import { BrowserWalletConnector } from './BrowserWalletConnector';
import type { ConnectorFactory } from './registry';
import { createAzguardAdapter } from '../adapters';

/**
 * Embedded wallet connector preset.
 * Uses app-managed PXE with internal signing.
 * Usage: connectors: [embedded()]
 */
export const embedded = (): ConnectorFactory => createEmbeddedConnector;

/**
 * Azguard wallet connector preset.
 * Uses external PXE (browser extension).
 * Usage: connectors: [azguard()]
 */
export const azguard = (): ConnectorFactory => () =>
  new BrowserWalletConnector({
    id: 'azguard',
    label: 'Azguard Wallet',
    adapterFactory: createAzguardAdapter,
  });
