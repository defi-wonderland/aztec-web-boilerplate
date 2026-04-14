/**
 * Wallet Presets Registry
 *
 * Pre-configured wallet definitions that developers can reference by ID.
 * This simplifies the config - devs just pass ['metamask', 'rabby'] instead of full configs.
 */

import { MetaMaskIcon, RabbyIcon, AzguardIcon } from '../assets/icons';
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
  /** Provider ID for wallet-sdk discovery matching (e.g., 'azguard-wallet') */
  providerId: string;
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
    providerId: 'azguard-wallet',
  },
  // Add more Aztec wallets as they become available:
  // obsidian: {
  //   id: 'obsidian',
  //   name: 'Obsidian',
  //   icon: ObsidianIcon,
  //   providerId: 'obsidian-wallet',
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
