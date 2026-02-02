import React from 'react';
import { iconSize, type IconSize } from '../../../utils';
import type { IconType } from '../../types';

export interface IconRendererProps {
  /** Icon - emoji string, URL, or React component */
  icon?: IconType;
  /** Size for component icons (default: 'sm') */
  size?: IconSize;
  /** CSS classes */
  className?: string;
  /** Alt text for image icons */
  alt?: string;
}

/**
 * Universal icon renderer component
 *
 * Handles rendering of different icon types:
 * - String (emoji like "🌐")
 * - URL (http://, /, data:)
 * - React component (Lucide icons, custom SVG components)
 *
 * @example
 * ```tsx
 * // With emoji
 * <IconRenderer icon="🌐" className={styles.icon} />
 *
 * // With URL
 * <IconRenderer icon="/icons/wallet.png" alt="Wallet" className={styles.icon} />
 *
 * // With Lucide component
 * <IconRenderer icon={Globe} size="md" className={styles.icon} />
 * ```
 */
export const IconRenderer: React.FC<IconRendererProps> = ({
  icon,
  size = 'sm',
  className,
  alt = '',
}) => {
  if (!icon) return null;

  // String: URL or emoji/text
  if (typeof icon === 'string') {
    // URL (image)
    if (
      icon.startsWith('http') ||
      icon.startsWith('/') ||
      icon.startsWith('data:')
    ) {
      return <img src={icon} alt={alt} className={className} />;
    }
    // Emoji or text
    return <span className={className}>{icon}</span>;
  }

  // React component (Lucide, custom SVG, memo wrapped, etc.)
  const IconComponent = icon;
  return <IconComponent size={iconSize(size)} className={className} />;
};
