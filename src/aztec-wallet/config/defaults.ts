import type { EmbeddedGroupConfig } from '../types';

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
