/**
 * Wallet Presets Registry
 *
 * Pre-configured wallet definitions that developers can reference by ID.
 * This simplifies the config - devs just pass ['azguard'] instead of full configs.
 */

import { AzguardIcon } from '../assets/icons';
import type { IconType } from '../types';
import type { IBrowserWalletAdapter } from '../types/browserWalletAdapter';

// =============================================================================
// Types
// =============================================================================

export interface AztecWalletPreset {
  id: string;
  name: string;
  icon: IconType;
  /** Lazy adapter factory - only imported when needed (async for dynamic imports) */
  getAdapter: () => Promise<IBrowserWalletAdapter>;
  /** Check if wallet extension is installed (optional, async) */
  checkInstalled?: () => Promise<boolean>;
}

// =============================================================================
// Aztec Wallet Presets
// =============================================================================

export const AZTEC_WALLET_PRESETS: Record<string, AztecWalletPreset> = {
  azguard: {
    id: 'azguard',
    name: 'Azguard',
    icon: AzguardIcon,
    getAdapter: async () => {
      // Dynamic import to avoid bundling if not used (ESM-compatible)
      const { AzguardAdapter } = await import('../adapters/azguard');
      return new AzguardAdapter();
    },
    checkInstalled: async () => {
      // Lazy import to avoid bundling the client if not used
      const { AzguardClient } = await import('@azguardwallet/client');
      return AzguardClient.isAzguardInstalled();
    },
  },
  // Add more Aztec wallets as they become available:
  // obsidian: {
  //   id: 'obsidian',
  //   name: 'Obsidian',
  //   icon: ObsidianIcon, // Use icon component
  //   getAdapter: () => {
  //     const { ObsidianAdapter } = require('../../adapters/obsidian');
  //     return new ObsidianAdapter();
  //   },
  //   checkInstalled: async () => {
  //     // Check for window.obsidian or similar
  //     return typeof window !== 'undefined' && 'obsidian' in window;
  //   },
  // },
};

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get Aztec wallet preset by ID
 */
export function getAztecWalletPreset(
  id: string
): AztecWalletPreset | undefined {
  return AZTEC_WALLET_PRESETS[id];
}

/**
 * Get all available Aztec wallet IDs
 */
export function getAvailableAztecWalletIds(): string[] {
  return Object.keys(AZTEC_WALLET_PRESETS);
}

// =============================================================================
// Type helpers for config
// =============================================================================

/** Known Aztec wallet IDs */
export type AztecWalletId = keyof typeof AZTEC_WALLET_PRESETS;
