import { EVM_WALLETS, type EVMWalletId } from '../../config/evmWallets';
import { createAzguardAdapter } from '../adapters';
import { ExternalSignerType } from '../types/aztec';
import { BrowserWalletConnector } from './BrowserWalletConnector';
import { createEmbeddedConnector } from './EmbeddedConnector';
import { ExternalSignerConnector } from './ExternalSignerConnector';
import type { ConnectorFactory } from './registry';

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

/**
 * EVM wallet connector factory.
 * Uses app-managed PXE with any EVM wallet (MetaMask, Rabby, etc.) as external signer.
 *
 * Usage: connectors: [evmWallet('metamask'), evmWallet('rabby')]
 *
 * @param walletId - The wallet ID from EVM_WALLETS config
 */
export const evmWallet = (walletId: EVMWalletId): ConnectorFactory => {
  const config = EVM_WALLETS[walletId];
  return () =>
    new ExternalSignerConnector({
      id: config.id,
      label: config.label,
      signerType: ExternalSignerType.EVM_WALLET,
      rdns: config.rdns,
    });
};
