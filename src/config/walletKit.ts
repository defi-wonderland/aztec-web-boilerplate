import { embedded, azguard } from '../connectors';
import type { WalletKitConfig } from '../sdk/walletKitConfig';
import { NETWORK_URLS } from './networks';

export const walletKitConfig: WalletKitConfig = {
  connectors: [embedded(), azguard()],
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
