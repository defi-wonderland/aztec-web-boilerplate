import React from 'react';
import { cn } from '../../../utils';

const styles = {
  container: 'flex items-center justify-center',
  sizes: {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  },
} as const;

export type WalletIconSize = keyof typeof styles.sizes;

export interface WalletIconWrapperProps {
  /** The icon component or element to render */
  icon: React.ReactNode;
  /** Size variant. Defaults to 'md' (24px) */
  size?: WalletIconSize;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Wrapper component for consistent wallet icon sizing.
 *
 * Use this when you need to display a wallet icon with standardized dimensions.
 * For custom icon components, pass them directly with the `size` prop instead.
 *
 * @example
 * ```tsx
 * // Using with a custom icon element
 * <WalletIconWrapper icon={<MetaMaskIcon size={24} />} size="md" />
 *
 * // Using as a container for consistency
 * <WalletIconWrapper icon={<img src="/icon.png" alt="wallet" />} size="lg" />
 * ```
 */
export const WalletIconWrapper: React.FC<WalletIconWrapperProps> = ({
  icon,
  size = 'md',
  className,
}) => {
  return (
    <div className={cn(styles.container, styles.sizes[size], className)}>
      {icon}
    </div>
  );
};

/**
 * Utility to get pixel size from WalletIconSize variant
 */
export const walletIconSizeMap: Record<WalletIconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
};

/**
 * Get the numeric pixel size for a WalletIconSize variant
 */
export function getWalletIconSize(size: WalletIconSize = 'md'): number {
  return walletIconSizeMap[size];
}
