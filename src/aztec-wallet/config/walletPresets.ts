/**
 * Wallet Presets Registry
 *
 * Pre-configured wallet definitions that developers can reference by ID.
 * This simplifies the config - devs just pass ['metamask', 'rabby'] instead of full configs.
 */

import { MetaMaskIcon, RabbyIcon, AzguardIcon } from '../assets/icons';
import type { IBrowserWalletAdapter } from '../../types/browserWallet';
import type { IconType } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface EVMWalletPreset {
  id: string;
  name: string;
  icon: IconType;
  rdns: string;
}

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
// EVM Wallet Presets
// =============================================================================

export const EVM_WALLET_PRESETS: Record<string, EVMWalletPreset> = {
  metamask: {
    id: 'metamask',
    name: 'MetaMask',
    icon: MetaMaskIcon,
    rdns: 'io.metamask',
  },
  rabby: {
    id: 'rabby',
    name: 'Rabby',
    icon: RabbyIcon,
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
