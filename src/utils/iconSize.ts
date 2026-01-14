/**
 * Icon size utility for consistent Lucide icon sizing across the app.
 *
 * Returns pixel values to use with Lucide's `size` prop.
 *
 * @example
 * import { Home } from 'lucide-react';
 * import { iconSize } from '../utils';
 *
 * <Home size={iconSize()} />              // sm (default, 16px)
 * <Home size={iconSize('md')} />          // medium (20px)
 * <Home size={iconSize('xl')} />          // extra large (32px)
 *
 * // With additional styling
 * <Home size={iconSize('lg')} className="text-accent" />
 */

const sizes = {
  xs: 12, // h-3 = 0.75rem = 12px
  sm: 16, // h-4 = 1rem = 16px
  md: 20, // h-5 = 1.25rem = 20px
  lg: 24, // h-6 = 1.5rem = 24px
  xl: 32, // h-8 = 2rem = 32px
  '2xl': 48, // h-12 = 3rem = 48px
} as const;

export type IconSize = keyof typeof sizes;

/**
 * Returns pixel size for Lucide icons.
 * @param size - Size variant: 'xs', 'sm' (default), 'md', 'lg', 'xl', '2xl'
 * @returns Pixel value for the icon size
 */
export const iconSize = (size: IconSize = 'sm'): number => sizes[size];
