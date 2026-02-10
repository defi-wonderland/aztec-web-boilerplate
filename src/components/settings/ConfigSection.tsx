import React from 'react';
import { cn } from '../../utils';

type IconVariant = 'green' | 'purple' | 'amber';
type BadgeVariant = 'online' | 'count';

interface ConfigSectionBadge {
  text: string;
  variant: BadgeVariant;
}

export interface ConfigSectionProps {
  icon: React.ReactNode;
  iconVariant: IconVariant;
  title: string;
  badge?: ConfigSectionBadge;
  children: React.ReactNode;
  className?: string;
}

const ICON_BG_STYLES: Record<IconVariant, string> = {
  green: 'bg-emerald-500/20 dark:bg-emerald-500/30',
  purple: 'bg-[var(--accent-primary)]/20',
  amber: 'bg-amber-500/20 dark:bg-amber-500/30',
};

const BADGE_STYLES: Record<BadgeVariant, { container: string; text: string }> =
  {
    online: {
      container:
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/20',
      text: 'text-xs font-medium text-green-700 dark:text-green-400',
    },
    count: {
      container: 'px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/20',
      text: 'text-xs font-medium text-accent',
    },
  };

const styles = {
  container: 'rounded-2xl overflow-hidden bg-card',
  header:
    'flex items-center gap-2 md:gap-3 px-4 py-3 md:px-5 md:py-4 bg-surface-tertiary rounded-t-2xl border-b border-default',
  iconBox:
    'w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs md:text-sm',
  title: 'text-sm md:text-[15px] font-semibold text-default flex-1',
  onlineDot: 'w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400',
  body: 'p-4 md:p-5',
} as const;

/**
 * ConfigSection component for grouping related configuration values.
 */
export const ConfigSection: React.FC<ConfigSectionProps> = ({
  icon,
  iconVariant,
  title,
  badge,
  children,
  className,
}) => {
  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.header}>
        <div className={cn(styles.iconBox, ICON_BG_STYLES[iconVariant])}>
          {icon}
        </div>
        <span className={styles.title}>{title}</span>
        {badge && (
          <div className={BADGE_STYLES[badge.variant].container}>
            {badge.variant === 'online' && <div className={styles.onlineDot} />}
            <span className={BADGE_STYLES[badge.variant].text}>
              {badge.text}
            </span>
          </div>
        )}
      </div>

      <div className={styles.body}>{children}</div>
    </div>
  );
};
