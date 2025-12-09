import { EmbeddedConnector } from './EmbeddedConnector';
import { AzguardConnector } from './AzguardConnector';
import { MetaMaskAztecConnector } from './MetaMaskAztecConnector';
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

/**
 * MetaMask Aztec wallet connector preset.
 * Uses MetaMask as external signer for Aztec transactions.
 * Usage: connectors: [metamaskAztec()]
 */
export const metamaskAztec = (): ConnectorFactory => () => new MetaMaskAztecConnector();

