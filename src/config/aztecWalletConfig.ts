/**
 * AztecWallet Configuration
 *
 * Simple API - just pass wallet IDs and we handle the rest.
 * Available wallets:
 *   - Aztec: 'azguard'
 */

import { createAztecWalletConfig } from '../aztec-wallet';
import { DEFAULT_NETWORK, NETWORK_URLS } from './networks';

/**
 * Main AztecWallet configuration
 *
 * Simple API - just pass wallet IDs:
 * - embedded: true/false
 * - aztecWallets: ['azguard', ...]
 */
export const aztecWalletConfig = createAztecWalletConfig({
  // Networks
  networks: [
    { name: 'devnet', displayName: 'Devnet', nodeUrl: NETWORK_URLS.devnet },
    {
      name: 'sandbox',
      displayName: 'Local Network',
      nodeUrl: NETWORK_URLS.sandbox,
    },
  ],
  defaultNetwork: DEFAULT_NETWORK,

  // Wallet groups - the single source of truth for which wallets to enable
  walletGroups: {
    embedded: false,
    aztecWallets: ['azguard'],
  },

  // Show network picker in header ('full' | 'compact' | undefined)
  showNetworkPicker: 'full',

  // Modal customization (optional)
  modal: {
    title: 'Connect Wallet',
  },
});
