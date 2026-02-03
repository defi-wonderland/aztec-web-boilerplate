import { isStringArray } from '../../utils';
import { BrowserWalletConnector } from '../connectors/BrowserWalletConnector';
import { createEmbeddedConnector } from '../connectors/EmbeddedConnector';
import { ExternalSignerConnector } from '../connectors/ExternalSignerConnector';
import { ExternalSignerType } from '../types/aztec';
import {
  DEFAULT_LABELS,
  DEFAULT_MODAL_CONFIG,
  DEFAULT_EMBEDDED_CONFIG,
} from './defaults';
import {
  getAztecWalletPreset,
  getEVMWalletPreset,
  AZTEC_WALLET_PRESETS,
} from './walletPresets';
import type { ConnectorFactory } from '../connectors/registry';
import type {
  AztecWalletConfig,
  AztecBrowserWalletConfig,
  AztecWalletsGroupConfig,
  EmbeddedGroupConfig,
  EVMWalletConfig,
  EVMWalletsGroupConfig,
  ResolvedAztecWalletConfig,
} from '../types';

/**
 * Check if value is a full group config (has 'wallets' property)
 */
function isFullGroupConfig(
  value: unknown
): value is { wallets: unknown[]; label?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'wallets' in value &&
    Array.isArray((value as { wallets: unknown }).wallets)
  );
}

/**
 * Resolve EVM wallet IDs to full wallet configs
 */
function resolveEVMWallets(ids: string[]): EVMWalletConfig[] {
  const wallets: EVMWalletConfig[] = [];

  for (const id of ids) {
    const preset = getEVMWalletPreset(id);
    if (preset) {
      wallets.push({
        id: preset.id,
        name: preset.name,
        icon: preset.icon,
        rdns: preset.rdns,
      });
    } else {
      console.warn(
        `AztecWallet: Unknown EVM wallet "${id}". Available: metamask, rabby`
      );
    }
  }

  return wallets;
}

/**
 * Resolve Aztec wallet IDs to full wallet configs
 */
function resolveAztecWallets(ids: string[]): AztecBrowserWalletConfig[] {
  const wallets: AztecBrowserWalletConfig[] = [];

  for (const id of ids) {
    const preset = getAztecWalletPreset(id);
    if (preset) {
      wallets.push({
        id: preset.id,
        name: preset.name,
        icon: preset.icon,
        adapter: preset.getAdapter,
        checkInstalled: preset.checkInstalled,
      });
    } else {
      const available = Object.keys(AZTEC_WALLET_PRESETS).join(', ');
      console.warn(
        `AztecWallet: Unknown Aztec wallet "${id}". Available: ${available}`
      );
    }
  }

  return wallets;
}

/**
 * Create connector factories from resolved wallet groups.
 * This is called internally by createAztecWalletConfig.
 */
function createConnectorsFromWalletGroups(walletGroups: {
  embedded: EmbeddedGroupConfig | false;
  aztecWallets: AztecWalletsGroupConfig | false;
  evmWallets: EVMWalletsGroupConfig | false;
}): ConnectorFactory[] {
  const connectors: ConnectorFactory[] = [];

  // Add embedded connector
  if (walletGroups.embedded !== false) {
    connectors.push(createEmbeddedConnector);
  }

  // Add EVM wallet connectors (external signers)
  if (walletGroups.evmWallets !== false) {
    for (const wallet of walletGroups.evmWallets.wallets) {
      connectors.push(
        () =>
          new ExternalSignerConnector({
            id: wallet.id,
            label: wallet.name,
            signerType: ExternalSignerType.EVM_WALLET,
            rdns: wallet.rdns,
          })
      );
    }
  }

  // Add Aztec browser wallet connectors
  if (walletGroups.aztecWallets !== false) {
    for (const wallet of walletGroups.aztecWallets.wallets) {
      const preset = AZTEC_WALLET_PRESETS[wallet.id];
      if (preset) {
        connectors.push(
          () =>
            new BrowserWalletConnector({
              id: wallet.id,
              label: wallet.name,
              adapterFactory: preset.getAdapter,
            })
        );
      }
    }
  }

  return connectors;
}

/**
 * Create an AztecWallet configuration with defaults applied
 *
 * Supports both simple and advanced configuration formats.
 *
 * @param config - User configuration
 * @returns Resolved configuration with all defaults applied
 *
 * @example Simple config (recommended)
 * ```ts
 * const config = createAztecWalletConfig({
 *   networks: [{ name: 'devnet', nodeUrl: '...' }],
 *   walletGroups: {
 *     embedded: true,
 *     evmWallets: ['metamask', 'rabby'],
 *     aztecWallets: ['azguard'],
 *   },
 * });
 * ```
 *
 * @example Advanced config (custom wallets)
 * ```ts
 * const config = createAztecWalletConfig({
 *   networks: [{ name: 'devnet', nodeUrl: '...' }],
 *   walletGroups: {
 *     embedded: { label: 'Create Account' },
 *     evmWallets: {
 *       label: 'Connect EVM',
 *       wallets: [{ id: 'custom', name: 'Custom', icon: '...', rdns: '...' }],
 *     },
 *   },
 * });
 * ```
 */
export function createAztecWalletConfig(
  config: AztecWalletConfig
): ResolvedAztecWalletConfig {
  const { walletGroups } = config;

  // Resolve embedded config
  // Accepts: true, false, or { label?: string, enabled?: boolean }
  let resolvedEmbedded: ResolvedAztecWalletConfig['walletGroups']['embedded'];
  if (walletGroups.embedded === false) {
    resolvedEmbedded = false;
  } else if (walletGroups.embedded === true || !walletGroups.embedded) {
    resolvedEmbedded = { ...DEFAULT_EMBEDDED_CONFIG };
  } else {
    resolvedEmbedded = {
      ...DEFAULT_EMBEDDED_CONFIG,
      ...walletGroups.embedded,
    };
  }

  // Resolve Aztec wallets config
  // Accepts: false, ['azguard'], or { label?: string, wallets: [...] }
  let resolvedAztecWallets: AztecWalletsGroupConfig | false;
  if (walletGroups.aztecWallets === false || !walletGroups.aztecWallets) {
    resolvedAztecWallets = false;
  } else if (isStringArray(walletGroups.aztecWallets)) {
    // Simple config: ['azguard', 'obsidian']
    const wallets = resolveAztecWallets(walletGroups.aztecWallets);
    resolvedAztecWallets =
      wallets.length > 0
        ? { label: DEFAULT_LABELS.aztecWallets, wallets }
        : false;
  } else if (isFullGroupConfig(walletGroups.aztecWallets)) {
    // Full config: { label: '...', wallets: [...] }
    resolvedAztecWallets = {
      label: walletGroups.aztecWallets.label ?? DEFAULT_LABELS.aztecWallets,
      wallets: walletGroups.aztecWallets.wallets,
    };
  } else {
    resolvedAztecWallets = false;
  }

  // Resolve EVM wallets config
  // Accepts: false, ['metamask', 'rabby'], or { label?: string, wallets: [...] }
  let resolvedEvmWallets: EVMWalletsGroupConfig | false;
  if (walletGroups.evmWallets === false || !walletGroups.evmWallets) {
    resolvedEvmWallets = false;
  } else if (isStringArray(walletGroups.evmWallets)) {
    // Simple config: ['metamask', 'rabby']
    const wallets = resolveEVMWallets(walletGroups.evmWallets);
    resolvedEvmWallets =
      wallets.length > 0
        ? { label: DEFAULT_LABELS.evmWallets, wallets }
        : false;
  } else if (isFullGroupConfig(walletGroups.evmWallets)) {
    // Full config: { label: '...', wallets: [...] }
    resolvedEvmWallets = {
      label: walletGroups.evmWallets.label ?? DEFAULT_LABELS.evmWallets,
      wallets: walletGroups.evmWallets.wallets,
    };
  } else {
    resolvedEvmWallets = false;
  }

  const resolvedWalletGroups: ResolvedAztecWalletConfig['walletGroups'] = {
    embedded: resolvedEmbedded,
    aztecWallets: resolvedAztecWallets,
    evmWallets: resolvedEvmWallets,
  };

  // Auto-create connectors from wallet groups
  const connectors = createConnectorsFromWalletGroups(resolvedWalletGroups);

  return {
    ...config,
    defaultNetwork: config.defaultNetwork ?? config.networks[0]?.name,
    modal: {
      ...DEFAULT_MODAL_CONFIG,
      ...config.modal,
    },
    walletGroups: resolvedWalletGroups,
    connectors,
  };
}
