import { azguard, embedded } from '../connectors';
import type { WalletKitPreset } from '../sdk/walletKitConfig';
import { NETWORK_URLS } from './networks';

/**
 * Edit this file to add/remove connectors or update Aztec node URLs.
 */
export const walletKitConfig: WalletKitPreset = {
  connectors: [embedded(), azguard()],
  networks: [
    {
      aztecNetwork: 'sandbox',
      nodeUrl: NETWORK_URLS.sandbox,
    },
    {
      aztecNetwork: 'devnet',
      nodeUrl: NETWORK_URLS.devnet,
    },
  ],
};
