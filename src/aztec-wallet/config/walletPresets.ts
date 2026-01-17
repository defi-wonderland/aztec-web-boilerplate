/**
 * Wallet Presets Registry
 *
 * Pre-configured wallet definitions that developers can reference by ID.
 * This simplifies the config - devs just pass ['metamask', 'rabby'] instead of full configs.
 */

import type { IBrowserWalletAdapter } from '../adapters/types';

// =============================================================================
// Types
// =============================================================================

export interface EVMWalletPreset {
  id: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface AztecWalletPreset {
  id: string;
  name: string;
  icon: string;
  /** Lazy adapter factory - only imported when needed */
  getAdapter: () => IBrowserWalletAdapter;
}

// =============================================================================
// EVM Wallet Presets
// =============================================================================

export const EVM_WALLET_PRESETS: Record<string, EVMWalletPreset> = {
  metamask: {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    rdns: 'io.metamask',
  },
  rabby: {
    id: 'rabby',
    name: 'Rabby',
    icon: '🐰',
    rdns: 'io.rabby',
  },
};

// =============================================================================
// Aztec Wallet Presets
// =============================================================================

export const AZTEC_WALLET_PRESETS: Record<string, AztecWalletPreset> = {
  azguard: {
    id: 'azguard',
    name: 'Azguard',
    icon: '🛡️',
    getAdapter: () => {
      // Lazy import to avoid bundling if not used
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AzguardAdapter } = require('../../adapters/azguard');
      return new AzguardAdapter();
    },
  },
  // Add more Aztec wallets as they become available:
  // obsidian: {
  //   id: 'obsidian',
  //   name: 'Obsidian',
  //   icon: '🔮',
  //   getAdapter: () => {
  //     const { ObsidianAdapter } = require('../../adapters/obsidian');
  //     return new ObsidianAdapter();
  //   },
  // },
};

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get EVM wallet preset by ID
 */
export function getEVMWalletPreset(id: string): EVMWalletPreset | undefined {
  return EVM_WALLET_PRESETS[id];
}

/**
 * Get Aztec wallet preset by ID
 */
export function getAztecWalletPreset(
  id: string
): AztecWalletPreset | undefined {
  return AZTEC_WALLET_PRESETS[id];
}

/**
 * Get all available EVM wallet IDs
 */
export function getAvailableEVMWalletIds(): string[] {
  return Object.keys(EVM_WALLET_PRESETS);
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

/** Known EVM wallet IDs */
export type EVMWalletId = keyof typeof EVM_WALLET_PRESETS;

/** Known Aztec wallet IDs */
export type AztecWalletId = keyof typeof AZTEC_WALLET_PRESETS;
