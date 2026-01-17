/**
 * AztecWallet Configuration
 *
 * Simple API - just pass wallet IDs and we handle the rest.
 * Available wallets:
 *   - EVM: 'metamask', 'rabby'
 *   - Aztec: 'azguard'
 */

import { NETWORK_URLS } from './networks';
import type { AztecWalletConfig } from '../aztec-wallet';

/**
 * Main AztecWallet configuration
 *
 * Simple API - just pass wallet IDs:
 * - embedded: true/false
 * - evmWallets: ['metamask', 'rabby', ...]
 * - aztecWallets: ['azguard', ...]
 */
export const aztecWalletConfig: AztecWalletConfig = {
  // Networks
  networks: [
    { name: 'devnet', displayName: 'Devnet', nodeUrl: NETWORK_URLS.devnet },
    { name: 'sandbox', displayName: 'Sandbox', nodeUrl: NETWORK_URLS.sandbox },
  ],
  defaultNetwork: 'devnet',

  // Wallet groups - just pass the IDs you want to show
  walletGroups: {
    embedded: true,
    aztecWallets: ['azguard'],
    evmWallets: ['metamask', 'rabby'],
  },

  // Show network picker in header ('full' | 'compact' | undefined)
  showNetworkPicker: 'full',

  // Modal customization (optional)
  modal: {
    title: 'Connect Wallet',
  },
};
