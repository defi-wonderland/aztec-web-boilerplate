import type { EmbeddedGroupConfig } from '../types';

/**
 * Application ID used by the demo wallet (Aztec Keychain) for discovery
 * and secure channel establishment via the wallet-sdk protocol.
 *
 * This is sent to the wallet extension during connection so it can identify
 * the dApp in its session list. Should match `metadata.name` in the
 * capability manifest for consistency.
 *
 * TODO: Make configurable via createAztecWalletConfig() for custom dApps.
 */
export const DEMO_WALLET_APP_ID = 'aztec-web-boilerplate';

/**
 * Default labels for wallet groups
 */
export const DEFAULT_LABELS = {
  embedded: 'Embedded Wallet',
  aztecWallets: 'Aztec Wallet',
  evmWallets: 'EVM Wallet',
} as const;

/**
 * Default modal configuration
 */
export const DEFAULT_MODAL_CONFIG = {
  title: 'Connect Wallet',
  subtitle:
    'Choose how you want to connect. Each option offers a different balance of convenience and security.',
} as const;

/**
 * Default embedded wallet configuration
 */
export const DEFAULT_EMBEDDED_CONFIG: EmbeddedGroupConfig = {
  label: DEFAULT_LABELS.embedded,
  enabled: true,
};
