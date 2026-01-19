import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { IBrowserWalletAdapter } from '../adapters/types';

/**
 * Network preset for AztecWallet configuration
 */
export interface NetworkPreset {
  /** Network identifier (e.g., 'devnet', 'sandbox') */
  name: string;
  /** Display name for UI */
  displayName?: string;
  /** Icon - emoji string or React component */
  icon?: string | React.ComponentType<{ className?: string; size?: number }>;
  /** Aztec node URL */
  nodeUrl: string;
}

/**
 * Configuration for embedded wallet group
 */
export interface EmbeddedGroupConfig {
  /** Button label (default: "Embedded Wallet") */
  label?: string;
  /** Whether this group is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Configuration for a single Aztec browser wallet (extension)
 * Used when providing custom wallet config instead of preset IDs
 */
export interface AztecBrowserWalletConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Icon - URL string or React component */
  icon?: string | React.ComponentType<{ className?: string }>;
  /** Factory function to create the adapter */
  adapter: () => IBrowserWalletAdapter;
  /** Check if wallet extension is installed (optional, async) */
  checkInstalled?: () => Promise<boolean>;
}

/**
 * Configuration for Aztec wallets group (full config version)
 */
export interface AztecWalletsGroupConfig {
  /** Button label (default: "Aztec Wallet") */
  label?: string;
  /** List of Aztec wallets to show */
  wallets: AztecBrowserWalletConfig[];
}

/**
 * Configuration for a single EVM wallet
 * Used when providing custom wallet config instead of preset IDs
 */
export interface EVMWalletConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Icon - URL string or React component */
  icon?: string | React.ComponentType<{ className?: string }>;
  /** EIP-6963 reverse domain name (e.g., 'io.metamask') */
  rdns: string;
}

/**
 * Configuration for EVM wallets group (full config version)
 */
export interface EVMWalletsGroupConfig {
  /** Button label (default: "EVM Wallet") */
  label?: string;
  /** List of EVM wallets to show */
  wallets: EVMWalletConfig[];
}

// =============================================================================
// Simplified Config Types (using preset IDs)
// =============================================================================

/**
 * Simplified Aztec wallets config - just pass wallet IDs
 * @example ['azguard', 'obsidian']
 */
export type AztecWalletsSimpleConfig = string[];

/**
 * Simplified EVM wallets config - just pass wallet IDs
 * @example ['metamask', 'rabby', 'coinbase']
 */
export type EVMWalletsSimpleConfig = string[];

/**
 * Wallet groups configuration
 *
 * Supports both simple and advanced configuration:
 *
 * @example Simple config (recommended)
 * ```ts
 * walletGroups: {
 *   embedded: true,
 *   evmWallets: ['metamask', 'rabby'],
 *   aztecWallets: ['azguard'],
 * }
 * ```
 *
 * @example Advanced config (custom wallets)
 * ```ts
 * walletGroups: {
 *   embedded: { label: 'Create Account' },
 *   evmWallets: {
 *     label: 'Connect EVM',
 *     wallets: [{ id: 'custom', name: 'Custom', icon: '🔧', rdns: 'com.custom' }],
 *   },
 * }
 * ```
 */
export interface WalletGroupsConfig {
  /**
   * Embedded wallet configuration
   * - `true` or `{}` = enabled with defaults
   * - `false` = disabled
   * - `{ label: '...' }` = custom label
   */
  embedded?: EmbeddedGroupConfig | boolean;

  /**
   * Aztec browser wallets configuration
   * - `['azguard']` = simple config with preset IDs
   * - `{ wallets: [...] }` = advanced config with custom wallets
   * - `false` = disabled
   */
  aztecWallets?: AztecWalletsGroupConfig | AztecWalletsSimpleConfig | false;

  /**
   * EVM wallets configuration
   * - `['metamask', 'rabby']` = simple config with preset IDs
   * - `{ wallets: [...] }` = advanced config with custom wallets
   * - `false` = disabled
   */
  evmWallets?: EVMWalletsGroupConfig | EVMWalletsSimpleConfig | false;
}

/**
 * Main AztecWallet configuration
 */
export interface AztecWalletConfig {
  /** Available networks */
  networks: NetworkPreset[];

  /** Default network name (defaults to first network) */
  defaultNetwork?: string;

  /** Wallet groups to display */
  walletGroups: WalletGroupsConfig;

  /**
   * Show network picker in the header
   * - `'full'` - Full button with icon and network name
   * - `'compact'` - Small icon-only button
   * - Not set or undefined - Don't show (default)
   */
  showNetworkPicker?: 'full' | 'compact';

  /** Connect modal configuration */
  modal?: {
    /** Custom title for connect modal */
    title?: string;
    /** Custom subtitle/description */
    subtitle?: string;
  };

  /** Account modal configuration */
  accountModal?: {
    /** Show network in account modal (default: false) */
    showNetwork?: boolean;
  };

  /** Callback when wallet connects */
  onConnect?: (account: AccountWithSecretKey) => void;

  /** Callback when wallet disconnects */
  onDisconnect?: () => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Internal resolved configuration with defaults applied
 */
export interface ResolvedAztecWalletConfig extends AztecWalletConfig {
  walletGroups: {
    embedded: EmbeddedGroupConfig | false;
    aztecWallets: AztecWalletsGroupConfig | false;
    evmWallets: EVMWalletsGroupConfig | false;
  };
}
