import React, { type ComponentType } from 'react';
import { iconSize, type IconSize } from '../../../utils';

export interface NetworkIconProps {
  /** The icon - either an emoji string or a Lucide-style component */
  icon: string | ComponentType<{ size?: number; className?: string }>;
  /** Size variant for component icons (default: 'sm') */
  size?: IconSize;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Network icon component that handles both emoji strings and Lucide components
 *
 * Centralizes the logic for rendering network icons, which can be either:
 * - A string (emoji like "🌐")
 * - A Lucide-style component (Globe, FlaskConical, etc.)
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
  if (typeof icon === 'string') {
    return <span className={className}>{icon}</span>;
  }

  const IconComponent = icon;
  return <IconComponent size={iconSize(size)} className={className} />;
};
