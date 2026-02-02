import React from 'react';
import { IconRenderer } from './IconRenderer';
import type { IconSize } from '../../../utils';
import type { IconType } from '../../types';

export interface NetworkIconProps {
  /** The icon - either an emoji string or a Lucide-style component */
  icon: IconType;
  /** Size variant for component icons (default: 'sm') */
  size?: IconSize;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Network icon component that handles both emoji strings and Lucide components
 *
 * This is a convenience wrapper around IconRenderer for network-specific icons.
 *
 * @example
 * ```tsx
 * // With emoji
 * <NetworkIcon icon="🌐" className={styles.icon} />
 *
 * // With Lucide component
 * <NetworkIcon icon={Globe} size="md" className={styles.icon} />
 * ```
 */
export const NetworkIcon: React.FC<NetworkIconProps> = ({
  icon,
  size = 'sm',
  className,
}) => {
  return <IconRenderer icon={icon} size={size} className={className} />;
};
