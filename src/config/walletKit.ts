import { embedded, evmWallet } from '../connectors';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import { NETWORK_URLS } from './networks';

/**
 * Edit this file to add/remove connectors or update Aztec node URLs.
 *
 * To add a new EVM wallet:
 * 1. Add entry to src/config/evmWallets.ts
 * 2. Add evmWallet('walletId') below
 *
 * Connector order matters: they render in UI in this sequence and the
 * registry uses this ordering unless a custom priority is provided.
 */
export const walletKitConfig: WalletKitConfig = {
  connectors: [embedded(), evmWallet('metamask'), evmWallet('rabby')],
  networks: [
    {
      aztecNetwork: 'devnet',
      nodeUrl: NETWORK_URLS.devnet,
    },
    {
      aztecNetwork: 'sandbox',
      nodeUrl: NETWORK_URLS.sandbox,
    },
  ],
};
