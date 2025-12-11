import {
  EmbeddedConnector,
  createEmbeddedConnector,
} from './EmbeddedConnector';
import {
  ExternalSignerConnector,
  createMetaMaskConnector,
} from './ExternalSignerConnector';
import {
  BrowserWalletConnector,
  createAzguardConnector,
} from './BrowserWalletConnector';
import type { ConnectorFactory } from './registry';
import { ExternalSignerType } from '../types/aztec';

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
export const azguard = (): ConnectorFactory => createAzguardConnector;

/**
 * MetaMask Aztec wallet connector preset.
 * Uses app-managed PXE with MetaMask as external signer.
 * Usage: connectors: [metamaskAztec()]
 */
export const metamaskAztec = (): ConnectorFactory => createMetaMaskConnector;

/**
 * Generic external signer connector factory.
 * Usage: connectors: [externalSigner({ signerType: ExternalSignerType.METAMASK })]
 */
export const externalSigner = (options: {
  signerType: ExternalSignerType;
  id?: string;
  label?: string;
}): ConnectorFactory => {
  return () =>
    new ExternalSignerConnector({
      signerType: options.signerType,
      id: options.id,
      label: options.label,
    });
};

/**
 * Browser wallet connector factory.
 * Usage: connectors: [browserWallet({ id: 'custom', label: 'Custom Wallet' })]
 */
export const browserWallet = (options?: {
  id?: string;
  label?: string;
}): ConnectorFactory => {
  return () => new BrowserWalletConnector(options);
};
