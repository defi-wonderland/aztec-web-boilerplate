import { azguard, embedded, metamaskAztec } from '../connectors';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import { NETWORK_URLS } from './networks';

/**
 * Edit this file to add/remove connectors or update Aztec node URLs.
 */
export const walletKitConfig: WalletKitConfig = {
  connectors: [embedded(), azguard(), metamaskAztec()],
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
