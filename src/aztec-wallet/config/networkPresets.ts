/**
 * Network Presets Registry
 *
 * Default icons and display names for known networks.
 * Users can override these in their config.
 */

import type { ComponentType } from 'react';
import { Globe, FlaskConical, Box, Rocket } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface NetworkPresetDefaults {
  /** Default display name */
  displayName: string;
  /** Default icon component */
  icon: ComponentType<{ className?: string; size?: number }>;
}

// =============================================================================
// Network Presets
// =============================================================================

export const NETWORK_PRESETS: Record<string, NetworkPresetDefaults> = {
  devnet: {
    displayName: 'Devnet',
    icon: Globe,
  },
  sandbox: {
    displayName: 'Sandbox',
    icon: FlaskConical,
  },
  testnet: {
    displayName: 'Testnet',
    icon: Box,
  },
  mainnet: {
    displayName: 'Mainnet',
    icon: Rocket,
  },
};

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get network preset defaults by name
 */
export function getNetworkPreset(
  name: string
): NetworkPresetDefaults | undefined {
  return NETWORK_PRESETS[name.toLowerCase()];
}

/**
 * Get the icon for a network (from config or preset defaults)
 */
export function getNetworkIcon(
  name: string,
  configIcon?: string | ComponentType<{ className?: string; size?: number }>
): ComponentType<{ className?: string; size?: number }> | string {
  // Use config icon if provided
  if (configIcon) {
    return configIcon;
  }

  // Fall back to preset icon
  const preset = getNetworkPreset(name);
  if (preset) {
    return preset.icon;
  }

  // Default to Globe icon
  return Globe;
}

/**
 * Get the display name for a network (from config or preset defaults)
 */
export function getNetworkDisplayName(
  name: string,
  configDisplayName?: string
): string {
  // Use config display name if provided
  if (configDisplayName) {
    return configDisplayName;
  }

  // Fall back to preset display name
  const preset = getNetworkPreset(name);
  if (preset) {
    return preset.displayName;
  }

  // Fall back to capitalized name
  return name.charAt(0).toUpperCase() + name.slice(1);
}
