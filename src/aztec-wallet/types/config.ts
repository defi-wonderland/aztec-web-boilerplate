import type { ComponentType } from 'react';
import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import type { IBrowserWalletAdapter } from './browserWalletAdapter';
import type { AztecNetwork } from '../../config/networks/constants';

/**
 * Icon type that supports emoji strings, URLs, or React components
 */
export type IconType =
  | string
  | ComponentType<{ className?: string; size?: number }>;

/**
 * Network preset for AztecWallet configuration
 */
export interface NetworkPreset {
  /** Network identifier (e.g., 'devnet', 'sandbox') */
  name: AztecNetwork;
  /** Display name for UI */
  displayName?: string;
  /** Icon - emoji string, URL, or React component */
  icon?: IconType;
  /** Aztec node URL */
  nodeUrl: string;
}

/**
 * Internal network preset format used by the store.
 * Includes aztecNetwork for compatibility with network configs.
 */
export interface StoreNetworkPreset {
  /** Aztec network identifier */
  aztecNetwork: AztecNetwork;
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
  /** Icon - emoji string, URL, or React component */
  icon?: IconType;
  /** Factory function to create the adapter (async for lazy loading) */
  adapter: () => Promise<IBrowserWalletAdapter>;
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

// =============================================================================
// Simplified Config Types (using preset IDs)
// =============================================================================

/**
 * Simplified Aztec wallets config - just pass wallet IDs
 * @example ['azguard', 'obsidian']
 */
export type AztecWalletsSimpleConfig = string[];

/**
 * Wallet groups configuration
 *
 * Supports both simple and advanced configuration:
 *
 * @example Simple config (recommended)
 * ```ts
 * walletGroups: {
 *   embedded: true,
 *   aztecWallets: ['azguard'],
 * }
 * ```
 *
 * @example Advanced config (custom wallets)
 * ```ts
 * walletGroups: {
 *   embedded: { label: 'Create Account' },
 *   aztecWallets: {
 *     label: 'Connect Aztec',
 *     wallets: [{ id: 'azguard', name: 'Azguard', adapter: () => import(...) }],
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

}

/**
 * Main AztecWallet configuration
 *
 * @example Simple config (recommended)
 * ```ts
 * const config = createAztecWalletConfig({
 *   networks: [{ name: 'devnet', nodeUrl: 'https://devnet.aztec.network' }],
 *   walletGroups: {
 *     embedded: true,
 *     aztecWallets: ['azguard'],
 *   },
 * });
 * ```
 */
export interface AztecWalletConfig {
  /** Available networks */
  networks: NetworkPreset[];

  /** Default network name (defaults to first network) */
  defaultNetwork?: string;

  /** Wallet groups to display - this is the single source of truth for which wallets to enable */
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
 * Internal resolved configuration with defaults applied.
 * This includes auto-created connectors from walletGroups.
 * @internal
 */
export interface ResolvedAztecWalletConfig
  extends Omit<AztecWalletConfig, 'walletGroups'> {
  walletGroups: {
    embedded: EmbeddedGroupConfig | false;
    aztecWallets: AztecWalletsGroupConfig | false;
  };
  /** Auto-created connector factories from walletGroups (internal use only) */
  connectors: import('../connectors/registry').ConnectorFactory[];
}
