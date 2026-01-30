import React from 'react';
import { cn } from '../../utils';

type IconVariant = 'green' | 'purple' | 'amber';
type BadgeVariant = 'online' | 'count';

interface ConfigSectionBadge {
  text: string;
  variant: BadgeVariant;
}

export interface ConfigSectionProps {
  icon: string; // Emoji icon
  iconVariant: IconVariant;
  title: string;
  badge?: ConfigSectionBadge;
  children: React.ReactNode;
  className?: string;
}

const ICON_BG_STYLES: Record<IconVariant, string> = {
  green: 'bg-[#10B981]/20 dark:bg-[#10b981]/30',
  purple: 'bg-[#8B5CF6]/20 dark:bg-[#a78bfa]/20',
  amber: 'bg-[#F59E0B]/20 dark:bg-[#f59e0b]/30',
};

const BADGE_STYLES: Record<BadgeVariant, { container: string; text: string }> =
  {
    online: {
      container:
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] dark:bg-[#22c55e]/20',
      text: 'text-xs font-medium text-[#15803D] dark:text-[#4ade80]',
    },
    count: {
      container:
        'px-2.5 py-1 rounded-full bg-[#8B5CF6]/20 dark:bg-[#a78bfa]/20',
      text: 'text-xs font-medium text-[#8B5CF6] dark:text-[#a78bfa]',
    },
  };

const styles = {
  container: 'rounded-2xl overflow-hidden bg-white dark:bg-[#1e1e24]',
  header:
    'flex items-center gap-2 md:gap-3 px-4 py-3 md:px-5 md:py-4 bg-[#F9FAFB] dark:bg-[#2a2a32] rounded-t-2xl border-b border-[#F3F4F6] dark:border-[#3a3a44]',
  iconBox:
    'w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs md:text-sm',
  title:
    'text-sm md:text-[15px] font-semibold text-[#1A1A1A] dark:text-white flex-1',
  onlineDot: 'w-1.5 h-1.5 rounded-full bg-[#22C55E] dark:bg-[#4ade80]',
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
